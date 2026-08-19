const express = require('express');
const { isValidObjectId } = require('mongoose');
const Todo = require('../models/Todo');
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

router.get('/', asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const search = (req.query.search || '').trim();

  const filter = { userId: req.user._id, ...parseDateRange(req.query) };
  if (search) {
    const re = { $regex: escapeRegex(search), $options: 'i' };
    filter.$or = [{ title: re }, { tags: re }];
  }

  const [items, total] = await Promise.all([
    Todo.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Todo.countDocuments(filter),
  ]);

  res.json(paginatedResponse(items, total, page, limit));
}));

router.post('/', asyncHandler(async (req, res) => {
  const { title } = req.body;
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'title (non-empty string) is required' });
  }
  const trimmed = title.trim();
  if (trimmed.length > Todo.TITLE_MAX_LENGTH) {
    return res
      .status(400)
      .json({ error: `title must be ${Todo.TITLE_MAX_LENGTH} characters or fewer` });
  }

  const tags = normalizeTags(req.body.tags);
  if (tags === null) {
    return res.status(400).json({ error: 'tags must be an array of strings' });
  }
  if (tags.length > Todo.TAGS_MAX_COUNT) {
    return res
      .status(400)
      .json({ error: `A todo can have at most ${Todo.TAGS_MAX_COUNT} tags` });
  }
  if (tags.some((t) => t.length > Todo.TAG_MAX_LENGTH)) {
    return res
      .status(400)
      .json({ error: `Each tag must be ${Todo.TAG_MAX_LENGTH} characters or fewer` });
  }

  const todo = await Todo.create({ title: trimmed, tags, userId: req.user._id });
  res.status(201).json(todo);
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Todo not found' });

  const { title, done, tags: rawTags } = req.body;
  const update = {};

  if (title !== undefined) {
    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'title (non-empty string) is required' });
    }
    const trimmed = title.trim();
    if (trimmed.length > Todo.TITLE_MAX_LENGTH) {
      return res
        .status(400)
        .json({ error: `title must be ${Todo.TITLE_MAX_LENGTH} characters or fewer` });
    }
    update.title = trimmed;
  }

  if (rawTags !== undefined) {
    const tags = normalizeTags(rawTags);
    if (tags === null) {
      return res.status(400).json({ error: 'tags must be an array of strings' });
    }
    if (tags.length > Todo.TAGS_MAX_COUNT) {
      return res
        .status(400)
        .json({ error: `A todo can have at most ${Todo.TAGS_MAX_COUNT} tags` });
    }
    if (tags.some((t) => t.length > Todo.TAG_MAX_LENGTH)) {
      return res
        .status(400)
        .json({ error: `Each tag must be ${Todo.TAG_MAX_LENGTH} characters or fewer` });
    }
    update.tags = tags;
  }

  if (done !== undefined) {
    if (typeof done !== 'boolean') {
      return res.status(400).json({ error: 'done must be a boolean' });
    }
    update.done = done;
  }

  if (Object.keys(update).length === 0) {
    return res.status(400).json({ error: 'title, tags, or done is required' });
  }

  const todo = await Todo.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    update,
    { new: true }
  );
  if (!todo) return res.status(404).json({ error: 'Todo not found' });
  res.json(todo);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Todo not found' });
  const todo = await Todo.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!todo) return res.status(404).json({ error: 'Todo not found' });
  res.status(204).send();
}));

module.exports = router;
