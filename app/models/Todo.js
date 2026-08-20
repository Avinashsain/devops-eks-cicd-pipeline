const { Schema, model } = require('mongoose');

const TITLE_MAX_LENGTH = 500;
const TAG_MAX_LENGTH = 30;
const TAGS_MAX_COUNT = 5;
const PRIORITIES = ['critical', 'high', 'medium', 'low'];
const RECURRENCES = ['none', 'daily', 'weekly', 'monthly'];

function computeNextDueDate(from, recurrence) {
  const base = from ? new Date(from) : new Date();
  const next = new Date(base);
  if (recurrence === 'daily') next.setDate(next.getDate() + 1);
  else if (recurrence === 'weekly') next.setDate(next.getDate() + 7);
  else if (recurrence === 'monthly') next.setMonth(next.getMonth() + 1);
  return next;
}

const todoSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: TITLE_MAX_LENGTH },
    done: { type: Boolean, default: false },
    tags: {
      type: [{ type: String, trim: true, maxlength: TAG_MAX_LENGTH }],
      default: [],
      validate: {
        validator: (tags) => tags.length <= TAGS_MAX_COUNT,
        message: `A todo can have at most ${TAGS_MAX_COUNT} tags`,
      },
    },
    priority: { type: String, enum: PRIORITIES, default: 'medium' },
    dueDate: { type: Date, default: null },
    pinned: { type: Boolean, default: false },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
    recurrence: { type: String, enum: RECURRENCES, default: 'none' },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

const Todo = model('Todo', todoSchema);
Todo.TITLE_MAX_LENGTH = TITLE_MAX_LENGTH;
Todo.TAG_MAX_LENGTH = TAG_MAX_LENGTH;
Todo.TAGS_MAX_COUNT = TAGS_MAX_COUNT;
Todo.PRIORITIES = PRIORITIES;
Todo.RECURRENCES = RECURRENCES;
Todo.computeNextDueDate = computeNextDueDate;

module.exports = Todo;
