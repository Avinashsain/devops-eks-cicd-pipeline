const { Schema, model } = require('mongoose');

const TITLE_MAX_LENGTH = 500;
const TAG_MAX_LENGTH = 30;
const TAGS_MAX_COUNT = 5;

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
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

const Todo = model('Todo', todoSchema);
Todo.TITLE_MAX_LENGTH = TITLE_MAX_LENGTH;
Todo.TAG_MAX_LENGTH = TAG_MAX_LENGTH;
Todo.TAGS_MAX_COUNT = TAGS_MAX_COUNT;

module.exports = Todo;
