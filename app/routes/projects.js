const express = require('express');
const { isValidObjectId } = require('mongoose');
const Project = require('../models/Project');
const Todo = require('../models/Todo');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const projects = await Project.find({ userId: req.user._id }).sort({ name: 1 });
  res.json(projects);
}));

router.post('/', asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name (non-empty string) is required' });
  }
  const trimmed = name.trim();
  if (trimmed.length > Project.NAME_MAX_LENGTH) {
    return res
      .status(400)
      .json({ error: `name must be ${Project.NAME_MAX_LENGTH} characters or fewer` });
  }

  const existing = await Project.findOne({ userId: req.user._id, name: trimmed });
  if (existing) {
    return res.status(409).json({ error: 'A project with that name already exists' });
  }

  const project = await Project.create({ name: trimmed, userId: req.user._id });
  res.status(201).json(project);
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Project not found' });

  const { name } = req.body;
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name (non-empty string) is required' });
  }
  const trimmed = name.trim();
  if (trimmed.length > Project.NAME_MAX_LENGTH) {
    return res
      .status(400)
      .json({ error: `name must be ${Project.NAME_MAX_LENGTH} characters or fewer` });
  }

  const existing = await Project.findOne({
    userId: req.user._id,
    name: trimmed,
    _id: { $ne: req.params.id },
  });
  if (existing) {
    return res.status(409).json({ error: 'A project with that name already exists' });
  }

  const project = await Project.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { name: trimmed },
    { new: true }
  );
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json(project);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Project not found' });

  const project = await Project.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!project) return res.status(404).json({ error: 'Project not found' });

  // Unassign rather than cascade-delete — removing a project shouldn't destroy tasks.
  await Todo.updateMany(
    { userId: req.user._id, projectId: project._id },
    { projectId: null }
  );
  res.status(204).send();
}));

module.exports = router;
