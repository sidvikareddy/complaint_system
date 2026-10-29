const express = require('express');
const PDFDocument = require('pdfkit');
const Complaint = require('../models/Complaint');
const { DISPLAY_STAFF } = require('../models/Complaint');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { STATUSES, CATEGORIES } = require('../models/Complaint');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();
router.use(protect, adminOnly);

const statusMap = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  REJECTED: 'Rejected'
};

function normalizeStatus(value) {
  return statusMap[String(value || '').toUpperCase()] || value;
}

function dateRange(startDate, endDate) {
  if (!startDate && !endDate) return undefined;
  const createdAt = {};
  if (startDate) createdAt.$gte = new Date(`${startDate}T00:00:00.000Z`);
  if (endDate) createdAt.$lte = new Date(`${endDate}T23:59:59.999Z`);
  return createdAt;
}

function complaintFilter(query) {
  const filter = {};
  const status = query.status ? normalizeStatus(query.status) : '';
  if (status && STATUSES.includes(status)) filter.status = status;
  if (query.category && CATEGORIES.includes(query.category)) filter.category = query.category;
  if (query.priority && ['Low', 'Medium', 'High'].includes(query.priority)) filter.priority = query.priority;
  const createdAt = dateRange(query.startDate, query.endDate);
  if (createdAt) filter.createdAt = createdAt;
  if (query.search) {
    const rx = new RegExp(String(query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ title: rx }, { location: rx }];
  }
  return filter;
}

router.get('/analytics', async (req, res, next) => {
  try {
    const [total, grouped] = await Promise.all([
      Complaint.countDocuments(),
      Complaint.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])
    ]);
    const counts = { total, pending: 0, inProgress: 0, resolved: 0, rejected: 0 };
    grouped.forEach(({ _id, count }) => {
      if (_id === 'Pending') counts.pending = count;
      if (_id === 'In Progress') counts.inProgress = count;
      if (_id === 'Resolved') counts.resolved = count;
      if (_id === 'Rejected') counts.rejected = count;
    });
    res.json({ ...counts, Total: total, Pending: counts.pending, 'In Progress': counts.inProgress, Resolved: counts.resolved, Rejected: counts.rejected });
  } catch (err) {
    next(err);
  }
});

router.get('/complaints', async (req, res, next) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
    const filter = complaintFilter(req.query);
    if (req.query.search) {
      const rx = new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const students = await User.find({ email: rx }).select('_id');
      filter.$or.push({ student: { $in: students.map((student) => student._id) } });
    }
    const [items, total] = await Promise.all([
      Complaint.find(filter)
        .populate('student', 'name email studentId')
        .populate('assignment.assignedTo', 'name email role department')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Complaint.countDocuments(filter)
    ]);
    res.json({ items, complaints: items, page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

router.put('/complaints/:id', async (req, res, next) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });
    const status = req.body.status ? normalizeStatus(req.body.status) : complaint.status;
    if (!STATUSES.includes(status)) return res.status(400).json({ message: 'Invalid status' });
    if (status === 'Rejected' && !String(req.body.rejectionReason || req.body.remarks || '').trim()) {
      return res.status(400).json({ message: 'A rejection reason is required' });
    }

    const previousStatus = complaint.status;
    const remarks = String(req.body.rejectionReason || req.body.remarks || '').trim();
    complaint.status = status;
    if (req.body.remarks !== undefined || status === 'Rejected') complaint.adminRemarks = remarks;
    if (status !== previousStatus) {
      complaint.history.push({ status, remarks, changedBy: req.user._id });
      await Notification.create({
        recipient: complaint.student,
        complaint: complaint._id,
        title: 'Complaint status updated',
        message: `"${complaint.title}" is now ${status}${remarks ? `: ${remarks}` : '.'}`
      });

    }
    if (req.body.department !== undefined || req.body.assignedTo !== undefined) {
      const assignedTo = req.body.assignedTo || null;
      const department = req.body.department || complaint.assignment.department || 'General';
      const displayStaff = DISPLAY_STAFF.find((person) => person.id === assignedTo && person.department === department);
      if (assignedTo) {
        const staff = displayStaff || await User.findOne({
          _id: assignedTo,
          role: { $in: ['staff', 'admin'] },
          department
        }).select('_id');
        if (!staff) return res.status(400).json({ message: 'Assigned user must belong to the selected department' });
      }
      complaint.assignment = {
        department,
        assignedTo: displayStaff ? null : assignedTo,
        assignedName: displayStaff ? displayStaff.name : '',
        assignedAt: new Date(),
        assignedBy: req.user._id
      };
    }
    await complaint.save();
    await complaint.populate([
      { path: 'student', select: 'name email studentId' },
      { path: 'assignment.assignedTo', select: 'name email role department' },
      { path: 'history.changedBy', select: 'name role' }
    ]);
    res.json(complaint);
  } catch (err) {
    next(err);
  }
});

router.get('/reports/export', async (req, res, next) => {
  try {
    const month = /^(\d{4})-(\d{2})$/.exec(req.query.month || '');
    const filter = {};
    if (month) {
      filter.createdAt = {
        $gte: new Date(Date.UTC(Number(month[1]), Number(month[2]) - 1, 1)),
        $lt: new Date(Date.UTC(Number(month[1]), Number(month[2]), 1))
      };
    }
    const complaints = await Complaint.find(filter).select('status category');
    const counts = { Pending: 0, 'In Progress': 0, Resolved: 0, Rejected: 0 };
    complaints.forEach((complaint) => { counts[complaint.status] = (counts[complaint.status] || 0) + 1; });
    const format = String(req.query.format || 'csv').toLowerCase();
    const label = month ? `${month[1]}-${month[2]}` : 'all';
    if (format === 'pdf') {
      res.attachment(`complaint-report-${label}.pdf`);
      const doc = new PDFDocument({ margin: 50 });
      doc.pipe(res).fontSize(18).text('Smart Campus Complaint Report');
      doc.moveDown().fontSize(11).text(`Month: ${label}`).text(`Total: ${complaints.length}`);
      Object.entries(counts).forEach(([status, count]) => doc.text(`${status}: ${count}`));
      return doc.end();
    }
    const csv = [
      ['Month', 'Total', 'Pending', 'In Progress', 'Resolved', 'Rejected'],
      [label, complaints.length, counts.Pending, counts['In Progress'], counts.Resolved, counts.Rejected]
    ].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    res.attachment(`complaint-report-${label}.csv`).type('text/csv').send(csv);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
