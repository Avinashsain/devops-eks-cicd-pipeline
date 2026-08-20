const express = require('express');
const { isValidObjectId } = require('mongoose');
const Todo = require('../models/Todo');
const Project = require('../models/Project');
const asyncHandler = require('../utils/asyncHandler');
const escapeRegex = require('../utils/escapeRegex');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const parseDateRange = require('../utils/dateRange');

const router = express.Router();

function normalizeTags(rawTags) {
  if (rawTags === undefined || rawTags === null) return [];
  if (!Array.isArray(rawTags)) return null;

  const seen = new Set();
  const result = [];
  for (const tag of rawTags) {
    if (typeof tag !== 'string') return null;
    const trimmed = tag.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function validateTitle(title) {
  if (typeof title !== 'string' || !title.trim()) {
    return { error: 'title (non-empty string) is required' };
  }
  const trimmed = title.trim();
  if (trimmed.length > Todo.TITLE_MAX_LENGTH) {
    return { error: `title must be ${Todo.TITLE_MAX_LENGTH} characters or fewer` };
  }
  return { value: trimmed };
}

function validateTags(rawTags) {
  const tags = normalizeTags(rawTags);
  if (tags === null) return { error: 'tags must be an array of strings' };
  if (tags.length > Todo.TAGS_MAX_COUNT) {
    return { error: `A todo can have at most ${Todo.TAGS_MAX_COUNT} tags` };
  }
  if (tags.some((t) => t.length > Todo.TAG_MAX_LENGTH)) {
    return { error: `Each tag must be ${Todo.TAG_MAX_LENGTH} characters or fewer` };
  }
  return { value: tags };
}

function validatePriority(priority) {
  if (!Todo.PRIORITIES.includes(priority)) {
    return { error: `priority must be one of: ${Todo.PRIORITIES.join(', ')}` };
  }
  return { value: priority };
}

function validateRecurrence(recurrence) {
  if (!Todo.RECURRENCES.includes(recurrence)) {
    return { error: `recurrence must be one of: ${Todo.RECURRENCES.join(', ')}` };
  }
  return { value: recurrence };
}

function validateDueDate(rawDueDate) {
  if (rawDueDate === null || rawDueDate === '') return { value: null };
  const parsed = new Date(rawDueDate);
  if (Number.isNaN(parsed.getTime())) return { error: 'dueDate must be a valid date' };
  return { value: parsed };
}

async function resolveProjectId(rawProjectId, userId) {
  if (rawProjectId === null || rawProjectId === '') return { value: null };
  if (!isValidObjectId(rawProjectId)) return { error: 'projectId is not valid' };
  const project = await Project.findOne({ _id: rawProjectId, userId });
  if (!project) return { error: 'projectId not found' };
  return { value: project._id };
}

router.get('/', asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const search = (req.query.search || '').trim();

  const filter = { userId: req.user._id, ...parseDateRange(req.query) };
  if (search) {
    const re = { $regex: escapeRegex(search), $options: 'i' };
    filter.$or = [{ title: re }, { tags: re }];
  }
  if (req.query.priority) {
    const r = validatePriority(req.query.priority);
    if (r.error) return res.status(400).json({ error: r.error });
    filter.priority = r.value;
  }
  if (req.query.projectId) {
    if (!isValidObjectId(req.query.projectId)) {
      return res.status(400).json({ error: 'projectId is not valid' });
    }
    filter.projectId = req.query.projectId;
  }

  const [items, total] = await Promise.all([
    Todo.find(filter).sort({ pinned: -1, createdAt: -1 }).skip(skip).limit(limit),
    Todo.countDocuments(filter),
  ]);

  res.json(paginatedResponse(items, total, page, limit));
}));

router.post('/', asyncHandler(async (req, res) => {
  const titleResult = validateTitle(req.body.title);
  if (titleResult.error) return res.status(400).json({ error: titleResult.error });

  const tagsResult = validateTags(req.body.tags);
  if (tagsResult.error) return res.status(400).json({ error: tagsResult.error });

  const doc = { title: titleResult.value, tags: tagsResult.value, userId: req.user._id };

  if (req.body.priority !== undefined) {
    const r = validatePriority(req.body.priority);
    if (r.error) return res.status(400).json({ error: r.error });
    doc.priority = r.value;
  }

  if (req.body.recurrence !== undefined) {
    const r = validateRecurrence(req.body.recurrence);
    if (r.error) return res.status(400).json({ error: r.error });
    doc.recurrence = r.value;
  }

  if (req.body.dueDate !== undefined) {
    const r = validateDueDate(req.body.dueDate);
    if (r.error) return res.status(400).json({ error: r.error });
    doc.dueDate = r.value;
  }

  if (req.body.projectId !== undefined) {
    const r = await resolveProjectId(req.body.projectId, req.user._id);
    if (r.error) return res.status(400).json({ error: r.error });
    doc.projectId = r.value;
  }

  if (typeof req.body.pinned === 'boolean') doc.pinned = req.body.pinned;

  const todo = await Todo.create(doc);
  res.status(201).json(todo);
}));

const SYNC_FIELD_VALIDATORS = {
  title: validateTitle,
  tags: validateTags,
  priority: validatePriority,
  recurrence: validateRecurrence,
  dueDate: validateDueDate,
};

function applySyncFields(todo, body) {
  for (const [field, validate] of Object.entries(SYNC_FIELD_VALIDATORS)) {
    if (body[field] === undefined) continue;
    const r = validate(body[field]);
    if (r.error) return r.error;
    todo[field] = r.value;
  }
  return null;
}

async function applyProjectId(todo, body, userId) {
  if (body.projectId === undefined) return null;
  const r = await resolveProjectId(body.projectId, userId);
  if (r.error) return r.error;
  todo.projectId = r.value;
  return null;
}

function applyPinned(todo, body) {
  if (body.pinned === undefined) return null;
  if (typeof body.pinned !== 'boolean') return 'pinned must be a boolean';
  todo.pinned = body.pinned;
  return null;
}

async function applyDone(todo, body) {
  if (body.done === undefined) return null;
  if (typeof body.done !== 'boolean') return 'done must be a boolean';

  const wasDone = todo.done;
  todo.done = body.done;

  if (!wasDone && todo.done && todo.recurrence !== 'none') {
    await Todo.create({
      title: todo.title,
      tags: todo.tags,
      priority: todo.priority,
      recurrence: todo.recurrence,
      projectId: todo.projectId,
      dueDate: Todo.computeNextDueDate(todo.dueDate, todo.recurrence),
      userId: todo.userId,
    });
  }
  return null;
}

router.patch('/:id', asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Todo not found' });

  const todo = await Todo.findOne({ _id: req.params.id, userId: req.user._id });
  if (!todo) return res.status(404).json({ error: 'Todo not found' });

  const body = req.body;
  const touchedFields = Object.keys(body).filter((key) =>
    ['title', 'tags', 'priority', 'recurrence', 'dueDate', 'projectId', 'pinned', 'done'].includes(
      key
    )
  );
  if (touchedFields.length === 0) {
    return res.status(400).json({ error: 'No valid fields provided to update' });
  }

  const syncError = applySyncFields(todo, body);
  if (syncError) return res.status(400).json({ error: syncError });

  const projectError = await applyProjectId(todo, body, req.user._id);
  if (projectError) return res.status(400).json({ error: projectError });

  const pinnedError = applyPinned(todo, body);
  if (pinnedError) return res.status(400).json({ error: pinnedError });

  const doneError = await applyDone(todo, body);
  if (doneError) return res.status(400).json({ error: doneError });

  await todo.save();
  res.json(todo);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Todo not found' });
  const todo = await Todo.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!todo) return res.status(404).json({ error: 'Todo not found' });
  res.status(204).send();
}));

module.exports = router;
