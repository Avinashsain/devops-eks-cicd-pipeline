const express = require('express');
const { isValidObjectId } = require('mongoose');
const User = require('../models/User');
const Todo = require('../models/Todo');
const asyncHandler = require('../utils/asyncHandler');
const escapeRegex = require('../utils/escapeRegex');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const parseDateRange = require('../utils/dateRange');

const router = express.Router();

router.get('/stats', asyncHandler(async (req, res) => {
  const [totalUsers, activeUsers, adminUsers, totalTodos, doneTodos, topUsers] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ active: true }),
    User.countDocuments({ role: 'admin' }),
    Todo.countDocuments(),
    Todo.countDocuments({ done: true }),
    Todo.aggregate([
      {
        $group: {
          _id: '$userId',
          todoCount: { $sum: 1 },
          doneCount: { $sum: { $cond: ['$done', 1, 0] } },
        },
      },
      { $sort: { todoCount: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      {
        $project: {
          _id: 0,
          id: '$_id',
          fullName: '$user.fullName',
          email: '$user.email',
          todoCount: 1,
          doneCount: 1,
        },
      },
    ]),
  ]);

  res.json({
    users: {
      total: totalUsers,
      active: activeUsers,
      inactive: totalUsers - activeUsers,
      admins: adminUsers,
      regular: totalUsers - adminUsers,
    },
    todos: {
      total: totalTodos,
      done: doneTodos,
      pending: totalTodos - doneTodos,
    },
    topUsers,
  });
}));

router.get('/users', asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const search = (req.query.search || '').trim();

  const filter = { ...parseDateRange(req.query) };
  if (search) {
    const re = { $regex: escapeRegex(search), $options: 'i' };
    filter.$or = [{ fullName: re }, { email: re }];
  }

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: 1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  res.json(paginatedResponse(users.map((u) => u.toSafeJSON()), total, page, limit));
}));

router.patch('/users/:id', asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(404).json({ error: 'User not found' });

  const { role, active } = req.body;
  const isSelf = req.params.id === req.user._id.toString();

  if (role !== undefined) {
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'role must be "user" or "admin"' });
    }
    if (isSelf && role !== 'admin') {
      return res.status(400).json({ error: 'You cannot demote yourself' });
    }
  }
  if (active !== undefined) {
    if (typeof active !== 'boolean') {
      return res.status(400).json({ error: 'active must be a boolean' });
    }
    if (isSelf && active === false) {
      return res.status(400).json({ error: 'You cannot deactivate yourself' });
    }
  }

  const update = {};
  if (role !== undefined) update.role = role;
  if (active !== undefined) update.active = active;

  const user = await User.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user.toSafeJSON());
}));

router.delete('/users/:id', asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(404).json({ error: 'User not found' });
  if (req.params.id === req.user._id.toString()) {
    return res.status(400).json({ error: 'You cannot delete yourself' });
  }

  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  await Todo.deleteMany({ userId: user._id });
  res.status(204).send();
}));

router.get('/todos', asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const search = (req.query.search || '').trim();

  const filter = { ...parseDateRange(req.query) };
  if (search) {
    const re = { $regex: escapeRegex(search), $options: 'i' };
    const matchingUsers = await User.find({ $or: [{ fullName: re }, { email: re }] }, '_id');
    filter.$or = [{ title: re }, { tags: re }, { userId: { $in: matchingUsers.map((u) => u._id) } }];
  }

  const [todos, total] = await Promise.all([
    Todo.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'fullName email'),
    Todo.countDocuments(filter),
  ]);

  const items = todos.map((t) => ({
    _id: t._id,
    title: t.title,
    done: t.done,
    tags: t.tags,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    user: t.userId
      ? { id: t.userId._id, fullName: t.userId.fullName, email: t.userId.email }
      : null,
  }));

  res.json(paginatedResponse(items, total, page, limit));
}));

router.delete('/todos/:id', asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Todo not found' });
  const todo = await Todo.findByIdAndDelete(req.params.id);
  if (!todo) return res.status(404).json({ error: 'Todo not found' });
  res.status(204).send();
}));

module.exports = router;
