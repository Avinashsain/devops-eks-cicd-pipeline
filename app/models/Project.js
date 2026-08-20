const { Schema, model } = require('mongoose');

const NAME_MAX_LENGTH = 60;

const projectSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: NAME_MAX_LENGTH },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

projectSchema.index({ userId: 1, name: 1 }, { unique: true });

const Project = model('Project', projectSchema);
Project.NAME_MAX_LENGTH = NAME_MAX_LENGTH;

module.exports = Project;
