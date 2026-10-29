const mongoose = require('mongoose');

const STATUSES = ['Pending', 'In Progress', 'Resolved', 'Rejected'];
const CATEGORIES = ['Classroom', 'Wi-Fi', 'Facilities', 'Library', 'Hostel', 'Other'];
const DEPARTMENTS = ['Classroom', 'IT Support', 'Facilities', 'Library', 'Hostel', 'CSE', 'General'];
const DISPLAY_STAFF = [
  { id: 'display-ravi-kumar', name: 'Ravi Kumar', department: 'IT Support' },
  { id: 'display-priya-singh', name: 'Priya Singh', department: 'Library' },
  { id: 'display-anil-das', name: 'Anil Das', department: 'Facilities' },
  { id: 'display-meena-roy', name: 'Meena Roy', department: 'Hostel' },
  { id: 'display-karan-shah', name: 'Karan Shah', department: 'Classroom' }
];

const historySchema = new mongoose.Schema(
  {
    status: { type: String, enum: STATUSES, required: true },
    remarks: { type: String, default: '' },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const internalNoteSchema = new mongoose.Schema(
  {
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const evidenceSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true }
  },
  { _id: false }
);

const complaintSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, enum: CATEGORIES, required: true },
    location: { type: String, trim: true, default: '' },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    evidence: { type: [evidenceSchema], default: [] },
    upvotedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    status: { type: String, enum: STATUSES, default: 'Pending' },
    adminRemarks: { type: String, default: '' },
    history: [historySchema],
    assignment: {
      department: { type: String, enum: DEPARTMENTS, default: 'General' },
      assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      assignedName: { type: String, default: '' },
      assignedAt: { type: Date, default: null },
      assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
    },
    internalNotes: [internalNoteSchema]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Complaint', complaintSchema);
module.exports.STATUSES = STATUSES;
module.exports.CATEGORIES = CATEGORIES;
module.exports.DEPARTMENTS = DEPARTMENTS;
module.exports.DISPLAY_STAFF = DISPLAY_STAFF;
