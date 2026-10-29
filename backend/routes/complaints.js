const express = require('express');
const fs = require('fs');
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { STATUSES, CATEGORIES, DEPARTMENTS, DISPLAY_STAFF } = require('../models/Complaint');
const { protect, adminOnly, studentOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

router.use(protect);

// Meta (categories & statuses) for dropdowns
router.get('/meta', (req, res) => res.json({ statuses: STATUSES, categories: CATEGORIES, departments: DEPARTMENTS, displayStaff: DISPLAY_STAFF }));

router.get('/duplicates', studentOnly, async (req, res, next) => {
  try {
    const title = typeof req.query.title === 'string' ? req.query.title.trim() : '';
    const location = typeof req.query.location === 'string' ? req.query.location.trim() : '';
    const priority = typeof req.query.priority === 'string' ? req.query.priority.trim() : '';
    if (!title || !location || !priority) return res.json([]);
    const exact = (value) => new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    const complaints = await Complaint.find({
      title: exact(title),
      location: exact(location),
      priority,
      status: { $in: ['Pending', 'In Progress'] }
    })
      .select('title category location description status upvotedBy createdAt')
      .populate('student', 'name')
      .sort({ createdAt: -1 })
      .limit(10);
    res.json(complaints.map((complaint) => ({
      ...complaint.toObject(),
      upvotes: complaint.upvotedBy.length,
      hasUpvoted: complaint.upvotedBy.some((id) => String(id) === String(req.user._id))
    })));
  } catch (err) {
    next(err);
  }
});

// Student: submit a complaint
router.post('/', studentOnly, upload.single('evidence'), async (req, res, next) => {
  try {
    const { title, category, location, description, priority } = req.body;
    if (!title || !category || !description) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ message: 'Title, category and description are required' });
    }
    if (!CATEGORIES.includes(category)) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ message: 'Invalid category' });
    }
    if (!['Low', 'Medium', 'High'].includes(priority)) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ message: 'Invalid priority' });
    }
    const exact = (value) => new RegExp(`^${String(value || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    const duplicate = await Complaint.exists({
      title: exact(title),
      location: exact(location),
      priority,
      status: { $in: ['Pending', 'In Progress'] }
    });
    if (duplicate) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(409).json({ message: 'This complaint has already been raised at this location with the same priority.' });
    }

    const complaint = await Complaint.create({
      student: req.user._id,
      title,
      category,
      location,
      description,
      priority,
      evidence: req.file
        ? [{
          url: `/uploads/${req.file.filename}`,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size
        }]
        : [],
      history: [{ status: 'Pending', remarks: 'Complaint submitted', changedBy: req.user._id }]
    });
    const admins = await User.find({ role: 'admin' }).select('_id');
    if (admins.length) {
      await Notification.insertMany(admins.map((admin) => ({
        recipient: admin._id,
        complaint: complaint._id,
        type: 'complaint_submitted',
        title: 'New complaint submitted',
        message: `"${complaint.title}" was submitted by ${req.user.name}.`
      })));
    }
    res.status(201).json(complaint);
  } catch (err) {
    next(err);
  }
});

// Student: own complaints (history dashboard)
router.get('/mine', studentOnly, async (req, res, next) => {
  try {
    const complaints = await Complaint.find({ student: req.user._id })
      .select('-internalNotes -assignment')
      .sort({ createdAt: -1 });
    const stats = { total: complaints.length };
    STATUSES.forEach((s) => (stats[s] = complaints.filter((c) => c.status === s).length));
    res.json({
      stats,
      complaints: complaints.map((complaint) => ({
        ...complaint.toObject(),
        upvotes: complaint.upvotedBy.length,
        hasUpvoted: complaint.upvotedBy.some((id) => String(id) === String(req.user._id))
      }))
    });
  } catch (err) {
    next(err);
  }
});

// Admin: dashboard stats
router.get('/stats', adminOnly, async (req, res, next) => {
  try {
    const [total, byStatus, byCategory] = await Promise.all([
      Complaint.countDocuments(),
      Complaint.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Complaint.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }])
    ]);
    const status = {};
    STATUSES.forEach((s) => (status[s] = 0));
    byStatus.forEach((r) => (status[r._id] = r.count));
    const category = {};
    byCategory.forEach((r) => (category[r._id] = r.count));
    res.json({ total, status, category });
  } catch (err) {
    next(err);
  }
});

// Admin: all complaints with optional filters
router.get('/', adminOnly, async (req, res, next) => {
  try {
    const { status, category, q } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (req.query.priority) filter.priority = req.query.priority;
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(`${req.query.from}T00:00:00.000Z`);
      if (req.query.to) filter.createdAt.$lte = new Date(`${req.query.to}T23:59:59.999Z`);
    }
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ title: rx }, { description: rx }, { location: rx }];
    }
    const complaints = await Complaint.find(filter)
      .populate('student', 'name email studentId')
      .populate('assignment.assignedTo', 'name email role department')
      .select('+upvotedBy')
      .sort({ createdAt: -1 });
    res.json(complaints.map((complaint) => ({
      ...complaint.toObject(),
      upvotes: complaint.upvotedBy.length
    })));
  } catch (err) {
    next(err);
  }
});

// Single complaint (owner student or admin)
router.get('/:id', async (req, res, next) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate('student', 'name email studentId')
      .populate('history.changedBy', 'name role')
      .populate('assignment.assignedTo', 'name email role department')
      .populate('assignment.assignedBy', 'name role')
      .populate('internalNotes.author', 'name role department');
    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });

    const isOwner = String(complaint.student._id) === String(req.user._id);
    if (req.user.role !== 'admin' && !isOwner) return res.status(403).json({ message: 'Forbidden' });
    if (req.user.role === 'student') {
      complaint.internalNotes = undefined;
      complaint.assignment = undefined;
    }
    res.json(complaint);
  } catch (err) {
    next(err);
  }
});

// Admin: update status
router.patch('/:id/status', adminOnly, async (req, res, next) => {
  try {
    const { status, remarks } = req.body;
    if (!STATUSES.includes(status)) return res.status(400).json({ message: 'Invalid status' });

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });

    const previousStatus = complaint.status;
    complaint.status = status;
    complaint.adminRemarks = remarks || '';
    complaint.history.push({ status, remarks: remarks || '', changedBy: req.user._id });
    await complaint.save();
    if (previousStatus !== status) {
      await Notification.create({
        recipient: complaint.student,
        complaint: complaint._id,
        title: 'Complaint status updated',
        message: `"${complaint.title}" is now ${status}${remarks ? `: ${remarks}` : '.'}`
      });

    }
    res.json(complaint);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/upvote', studentOnly, async (req, res, next) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });
    if (!['Pending', 'In Progress'].includes(complaint.status)) {
      return res.status(400).json({ message: 'Only open complaints can be upvoted' });
    }
    if (String(complaint.student) === String(req.user._id)) {
      return res.status(403).json({ message: 'You cannot upvote your own complaint' });
    }
    if (complaint.location.trim().toLowerCase() !== String(req.body.location || '').trim().toLowerCase()) {
      return res.status(403).json({ message: 'Upvotes are limited to students at the same location' });
    }
    const alreadyUpvoted = complaint.upvotedBy.some((id) => String(id) === String(req.user._id));
    if (alreadyUpvoted) complaint.upvotedBy.pull(req.user._id);
    else complaint.upvotedBy.addToSet(req.user._id);
    await complaint.save();
    res.json({ upvotes: complaint.upvotedBy.length, hasUpvoted: !alreadyUpvoted });
  } catch (err) {
    next(err);
  }
});

// Admin/staff: assign a complaint to a department and optional staff member
router.patch('/:id/assignment', adminOnly, async (req, res, next) => {
  try {
    const { department, assignedTo } = req.body;
    if (!DEPARTMENTS.includes(department)) {
      return res.status(400).json({ message: 'Invalid department' });
    }

    let assignee = null;
    if (assignedTo) {
      assignee = await User.findOne({
        _id: assignedTo,
        role: { $in: ['staff', 'admin'] }
      }).select('_id');
      if (!assignee) return res.status(400).json({ message: 'Assigned user is not staff or admin' });
    }

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });

    complaint.assignment = {
      department,
      assignedTo: assignee ? assignee._id : null,
      assignedAt: new Date(),
      assignedBy: req.user._id
    };
    await complaint.save();
    await complaint.populate('assignment.assignedTo', 'name email role department');
    await complaint.populate('assignment.assignedBy', 'name role');
    res.json(complaint.assignment);
  } catch (err) {
    next(err);
  }
});

// Admin/staff: add an internal note, never exposed through student endpoints
router.post('/:id/notes', adminOnly, async (req, res, next) => {
  try {
    const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
    if (!body) return res.status(400).json({ message: 'Note text is required' });

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });

    complaint.internalNotes.push({ body, author: req.user._id });
    await complaint.save();
    await complaint.populate('internalNotes.author', 'name role department');
    res.status(201).json(complaint.internalNotes[complaint.internalNotes.length - 1]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
