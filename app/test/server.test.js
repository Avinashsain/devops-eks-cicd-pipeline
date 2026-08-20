const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { connectDB, mongoose } = require('../db');
const { app, buildSessionMiddleware, loadUser, mountRoutes } = require('../server');
const User = require('../models/User');
const Todo = require('../models/Todo');

let mongod;
let sessionStore;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await connectDB(uri);
  process.env.SESSION_SECRET = 'test-secret';
  const { middleware, store } = buildSessionMiddleware(uri);
  sessionStore = store;
  app.use(middleware);
  app.use(loadUser);
  mountRoutes();
});

afterAll(async () => {
  await sessionStore.close();
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await mongoose.connection.dropDatabase();
});

function register(agent, email, password = 'password123', fullName) {
  return agent
    .post('/api/auth/register')
    .send({ fullName: fullName || 'Test User', email, password });
}

describe('Health check', () => {
  it('GET /health returns 200 and status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('Auth', () => {
  it('first registered user becomes admin, subsequent ones do not', async () => {
    const first = await register(request.agent(app), 'first@example.com');
    expect(first.statusCode).toBe(201);
    expect(first.body.role).toBe('admin');

    const second = await register(request.agent(app), 'second@example.com');
    expect(second.statusCode).toBe(201);
    expect(second.body.role).toBe('user');
  });

  it('rejects invalid email and short password', async () => {
    const agent = request.agent(app);
    const badEmail = await register(agent, 'not-an-email');
    expect(badEmail.statusCode).toBe(400);

    const shortPassword = await agent
      .post('/api/auth/register')
      .send({ fullName: 'Valid User', email: 'valid@example.com', password: 'short' });
    expect(shortPassword.statusCode).toBe(400);
  });

  it('rejects invalid or missing full name', async () => {
    const agent = request.agent(app);
    const blank = await agent
      .post('/api/auth/register')
      .send({ fullName: '   ', email: 'valid@example.com', password: 'password123' });
    expect(blank.statusCode).toBe(400);

    const tooLong = await agent
      .post('/api/auth/register')
      .send({ fullName: 'x'.repeat(101), email: 'valid@example.com', password: 'password123' });
    expect(tooLong.statusCode).toBe(400);

    const missing = await agent
      .post('/api/auth/register')
      .send({ email: 'valid@example.com', password: 'password123' });
    expect(missing.statusCode).toBe(400);
  });

  it('rejects duplicate registration by email, but allows shared full names', async () => {
    const agent = request.agent(app);
    await register(agent, 'dupe@example.com', 'password123', 'Same Name');

    const dupeEmail = await register(request.agent(app), 'dupe@example.com');
    expect(dupeEmail.statusCode).toBe(409);

    const sharedName = await register(
      request.agent(app),
      'different@example.com',
      'password123',
      'Same Name'
    );
    expect(sharedName.statusCode).toBe(201);
  });

  it('GET /api/auth/me requires auth', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.statusCode).toBe(401);
  });

  it('login succeeds with correct credentials and fails with wrong password', async () => {
    const agent = request.agent(app);
    await register(agent, 'login@example.com', 'password123');
    await agent.post('/api/auth/logout');

    const badLogin = await request
      .agent(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'wrongpass' });
    expect(badLogin.statusCode).toBe(401);

    const goodAgent = request.agent(app);
    const goodLogin = await goodAgent
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'password123' });
    expect(goodLogin.statusCode).toBe(200);

    const me = await goodAgent.get('/api/auth/me');
    expect(me.statusCode).toBe(200);
    expect(me.body.email).toBe('login@example.com');
  });

  it('logout clears the session', async () => {
    const agent = request.agent(app);
    await register(agent, 'logout@example.com');
    await agent.post('/api/auth/logout');
    const res = await agent.get('/api/auth/me');
    expect(res.statusCode).toBe(401);
  });

  it('reports Google auth as disabled when no credentials are configured', async () => {
    const res = await request(app).get('/api/auth/providers');
    expect(res.statusCode).toBe(200);
    expect(res.body.google).toBe(false);
  });

  it('denies local login for a password-less (Google-only) account', async () => {
    await User.create({
      fullName: 'Google Only',
      email: 'googleonly@example.com',
      googleId: 'fake-google-id-123',
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'googleonly@example.com', password: 'anything123' });
    expect(res.statusCode).toBe(401);
  });
});

describe('Todos API', () => {
  it('rejects unauthenticated access', async () => {
    const res = await request(app).get('/api/todos');
    expect(res.statusCode).toBe(401);
  });

  it('CRUDs todos scoped to the logged-in user', async () => {
    const agent = request.agent(app);
    await register(agent, 'todos@example.com');

    const empty = await agent.get('/api/todos');
    expect(empty.body.items).toEqual([]);
    expect(empty.body.total).toBe(0);

    const created = await agent.post('/api/todos').send({ title: 'Write tests' });
    expect(created.statusCode).toBe(201);
    expect(created.body.title).toBe('Write tests');
    expect(created.body.done).toBe(false);

    const rejected = await agent.post('/api/todos').send({ title: '   ' });
    expect(rejected.statusCode).toBe(400);

    const tooLong = await agent.post('/api/todos').send({ title: 'x'.repeat(501) });
    expect(tooLong.statusCode).toBe(400);

    const exactlyMax = await agent.post('/api/todos').send({ title: 'x'.repeat(500) });
    expect(exactlyMax.statusCode).toBe(201);

    const done = await agent.patch(`/api/todos/${created.body._id}`).send({ done: true });
    expect(done.statusCode).toBe(200);
    expect(done.body.done).toBe(true);

    const undone = await agent.patch(`/api/todos/${created.body._id}`).send({ done: false });
    expect(undone.statusCode).toBe(200);
    expect(undone.body.done).toBe(false);

    const badBody = await agent.patch(`/api/todos/${created.body._id}`).send({});
    expect(badBody.statusCode).toBe(400);

    const del = await agent.delete(`/api/todos/${created.body._id}`);
    expect(del.statusCode).toBe(204);

    const missing = await agent.patch(`/api/todos/${created.body._id}`).send({ done: true });
    expect(missing.statusCode).toBe(404);
  });

  it('lets a user edit their own todo title and tags', async () => {
    const agent = request.agent(app);
    await register(agent, 'editor@example.com');

    const created = await agent
      .post('/api/todos')
      .send({ title: 'Original title', tags: ['old'] });

    const edited = await agent
      .patch(`/api/todos/${created.body._id}`)
      .send({ title: 'Updated title', tags: ['new', 'urgent'] });
    expect(edited.statusCode).toBe(200);
    expect(edited.body.title).toBe('Updated title');
    expect(edited.body.tags).toEqual(['new', 'urgent']);

    const blankTitle = await agent
      .patch(`/api/todos/${created.body._id}`)
      .send({ title: '   ' });
    expect(blankTitle.statusCode).toBe(400);

    const tooLongTitle = await agent
      .patch(`/api/todos/${created.body._id}`)
      .send({ title: 'x'.repeat(501) });
    expect(tooLongTitle.statusCode).toBe(400);

    const tooManyTags = await agent
      .patch(`/api/todos/${created.body._id}`)
      .send({ tags: ['a', 'b', 'c', 'd', 'e', 'f'] });
    expect(tooManyTags.statusCode).toBe(400);

    // Editing someone else's todo should 404, not leak/modify it
    const otherAgent = request.agent(app);
    await register(otherAgent, 'noteditor@example.com');
    const cantEdit = await otherAgent
      .patch(`/api/todos/${created.body._id}`)
      .send({ title: 'Hijacked' });
    expect(cantEdit.statusCode).toBe(404);
  });

  it('keeps todos isolated between users', async () => {
    const agentA = request.agent(app);
    await register(agentA, 'usera@example.com');
    const todoA = await agentA.post('/api/todos').send({ title: "A's todo" });

    const agentB = request.agent(app);
    await register(agentB, 'userb@example.com');
    const listB = await agentB.get('/api/todos');
    expect(listB.body.items).toEqual([]);

    const crossDelete = await agentB.delete(`/api/todos/${todoA.body._id}`);
    expect(crossDelete.statusCode).toBe(404);
  });

  it('supports search and pagination', async () => {
    const agent = request.agent(app);
    await register(agent, 'paging@example.com');

    await agent.post('/api/todos').send({ title: 'Buy milk' });
    await agent.post('/api/todos').send({ title: 'Buy eggs' });
    await agent.post('/api/todos').send({ title: 'Walk the dog' });

    const searched = await agent.get('/api/todos').query({ search: 'buy' });
    expect(searched.body.items).toHaveLength(2);
    expect(searched.body.total).toBe(2);

    const page1 = await agent.get('/api/todos').query({ page: 1, limit: 2 });
    expect(page1.body.items).toHaveLength(2);
    expect(page1.body.total).toBe(3);
    expect(page1.body.totalPages).toBe(2);

    const page2 = await agent.get('/api/todos').query({ page: 2, limit: 2 });
    expect(page2.body.items).toHaveLength(1);
  });

  it('supports tags on todos, including validation and tag search', async () => {
    const agent = request.agent(app);
    await register(agent, 'tags@example.com');

    const created = await agent
      .post('/api/todos')
      .send({ title: 'Tagged todo', tags: ['Work', 'urgent', 'Work', '  '] });
    expect(created.statusCode).toBe(201);
    expect(created.body.tags).toEqual(['Work', 'urgent']);

    const noTags = await agent.post('/api/todos').send({ title: 'Untagged todo' });
    expect(noTags.statusCode).toBe(201);
    expect(noTags.body.tags).toEqual([]);

    const badType = await agent
      .post('/api/todos')
      .send({ title: 'Bad tags', tags: ['ok', 123] });
    expect(badType.statusCode).toBe(400);

    const tooMany = await agent
      .post('/api/todos')
      .send({ title: 'Bad tags', tags: ['a', 'b', 'c', 'd', 'e', 'f'] });
    expect(tooMany.statusCode).toBe(400);

    const tagTooLong = await agent
      .post('/api/todos')
      .send({ title: 'Bad tags', tags: ['x'.repeat(31)] });
    expect(tagTooLong.statusCode).toBe(400);

    const searchByTag = await agent.get('/api/todos').query({ search: 'urgent' });
    expect(searchByTag.body.items).toHaveLength(1);
    expect(searchByTag.body.items[0].title).toBe('Tagged todo');
  });

  it('supports filtering todos by created-date range', async () => {
    const agent = request.agent(app);
    await register(agent, 'daterange@example.com');

    const oldOne = await agent.post('/api/todos').send({ title: 'Old todo' });
    await agent.post('/api/todos').send({ title: 'New todo' });
    // Mongoose's timestamps plugin protects createdAt from Model.updateOne,
    // so go through the raw driver collection to backdate it for this test.
    await Todo.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(oldOne.body._id) },
      { $set: { createdAt: new Date('2020-01-01T00:00:00Z') } }
    );

    const fromRecent = await agent.get('/api/todos').query({ dateFrom: '2025-01-01' });
    expect(fromRecent.body.items).toHaveLength(1);
    expect(fromRecent.body.items[0].title).toBe('New todo');

    const untilOld = await agent.get('/api/todos').query({ dateTo: '2021-01-01' });
    expect(untilOld.body.items).toHaveLength(1);
    expect(untilOld.body.items[0].title).toBe('Old todo');

    const allOfThem = await agent.get('/api/todos');
    expect(allOfThem.body.items).toHaveLength(2);
  });

  it('supports priority on create, edit, and filtering', async () => {
    const agent = request.agent(app);
    await register(agent, 'priority@example.com');

    const defaulted = await agent.post('/api/todos').send({ title: 'No priority given' });
    expect(defaulted.body.priority).toBe('medium');

    const created = await agent
      .post('/api/todos')
      .send({ title: 'Urgent thing', priority: 'critical' });
    expect(created.statusCode).toBe(201);
    expect(created.body.priority).toBe('critical');

    const badCreate = await agent.post('/api/todos').send({ title: 'Bad', priority: 'nope' });
    expect(badCreate.statusCode).toBe(400);

    const edited = await agent
      .patch(`/api/todos/${defaulted.body._id}`)
      .send({ priority: 'low' });
    expect(edited.statusCode).toBe(200);
    expect(edited.body.priority).toBe('low');

    const badEdit = await agent
      .patch(`/api/todos/${defaulted.body._id}`)
      .send({ priority: 'nope' });
    expect(badEdit.statusCode).toBe(400);

    const filtered = await agent.get('/api/todos').query({ priority: 'critical' });
    expect(filtered.body.items).toHaveLength(1);
    expect(filtered.body.items[0].title).toBe('Urgent thing');
  });

  it('supports due dates, including clearing them', async () => {
    const agent = request.agent(app);
    await register(agent, 'duedate@example.com');

    const created = await agent
      .post('/api/todos')
      .send({ title: 'Has a deadline', dueDate: '2026-12-31T10:00:00.000Z' });
    expect(created.statusCode).toBe(201);
    expect(new Date(created.body.dueDate).toISOString()).toBe('2026-12-31T10:00:00.000Z');

    const badDate = await agent.post('/api/todos').send({ title: 'Bad', dueDate: 'not-a-date' });
    expect(badDate.statusCode).toBe(400);

    const cleared = await agent
      .patch(`/api/todos/${created.body._id}`)
      .send({ dueDate: null });
    expect(cleared.statusCode).toBe(200);
    expect(cleared.body.dueDate).toBeNull();
  });

  it('pins todos to the top regardless of creation order', async () => {
    const agent = request.agent(app);
    await register(agent, 'pinning@example.com');

    await agent.post('/api/todos').send({ title: 'First' });
    const second = await agent.post('/api/todos').send({ title: 'Second' });
    await agent.post('/api/todos').send({ title: 'Third' });

    await agent.patch(`/api/todos/${second.body._id}`).send({ pinned: true });

    const list = await agent.get('/api/todos');
    expect(list.body.items[0].title).toBe('Second');
    expect(list.body.items[0].pinned).toBe(true);

    const badPin = await agent
      .patch(`/api/todos/${second.body._id}`)
      .send({ pinned: 'yes' });
    expect(badPin.statusCode).toBe(400);
  });

  it('spawns the next occurrence when a recurring todo is completed', async () => {
    const agent = request.agent(app);
    await register(agent, 'recurring@example.com');

    const created = await agent.post('/api/todos').send({
      title: 'Water the plants',
      recurrence: 'daily',
      dueDate: '2026-06-01T09:00:00.000Z',
    });
    expect(created.statusCode).toBe(201);

    const completed = await agent
      .patch(`/api/todos/${created.body._id}`)
      .send({ done: true });
    expect(completed.statusCode).toBe(200);
    expect(completed.body.done).toBe(true);

    const list = await agent.get('/api/todos');
    expect(list.body.items).toHaveLength(2);
    const nextOccurrence = list.body.items.find((t) => !t.done);
    expect(nextOccurrence.title).toBe('Water the plants');
    expect(nextOccurrence.recurrence).toBe('daily');
    expect(new Date(nextOccurrence.dueDate).toISOString()).toBe('2026-06-02T09:00:00.000Z');

    // Un-completing (or re-completing an already-done todo) must not spawn again
    const list2 = await agent.get('/api/todos');
    expect(list2.body.total).toBe(2);
  });
});

describe('Projects API', () => {
  it('supports full project CRUD, scoped to the owner', async () => {
    const agent = request.agent(app);
    await register(agent, 'projectowner@example.com');

    const created = await agent.post('/api/projects').send({ name: 'Work' });
    expect(created.statusCode).toBe(201);
    expect(created.body.name).toBe('Work');

    const dupe = await agent.post('/api/projects').send({ name: 'Work' });
    expect(dupe.statusCode).toBe(409);

    const blank = await agent.post('/api/projects').send({ name: '   ' });
    expect(blank.statusCode).toBe(400);

    const list = await agent.get('/api/projects');
    expect(list.body).toHaveLength(1);

    const renamed = await agent
      .patch(`/api/projects/${created.body._id}`)
      .send({ name: 'Deep Work' });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.body.name).toBe('Deep Work');

    // Another user can't see or modify it
    const otherAgent = request.agent(app);
    await register(otherAgent, 'otherprojectuser@example.com');
    const otherList = await otherAgent.get('/api/projects');
    expect(otherList.body).toEqual([]);
    const otherPatch = await otherAgent
      .patch(`/api/projects/${created.body._id}`)
      .send({ name: 'Hijacked' });
    expect(otherPatch.statusCode).toBe(404);

    const del = await agent.delete(`/api/projects/${created.body._id}`);
    expect(del.statusCode).toBe(204);
  });

  it('assigns todos to projects and unassigns them when the project is deleted', async () => {
    const agent = request.agent(app);
    await register(agent, 'projecttodos@example.com');

    const project = await agent.post('/api/projects').send({ name: 'Launch' });

    const created = await agent
      .post('/api/todos')
      .send({ title: 'Ship it', projectId: project.body._id });
    expect(created.statusCode).toBe(201);
    expect(created.body.projectId).toBe(project.body._id);

    const badProject = await agent
      .post('/api/todos')
      .send({ title: 'Bad project', projectId: '507f1f77bcf86cd799439011' });
    expect(badProject.statusCode).toBe(400);

    const filtered = await agent.get('/api/todos').query({ projectId: project.body._id });
    expect(filtered.body.items).toHaveLength(1);

    await agent.delete(`/api/projects/${project.body._id}`);

    const unassigned = (await agent.get('/api/todos')).body.items.find(
      (t) => t._id === created.body._id
    );
    expect(unassigned.projectId).toBeNull();
  });
});

describe('Admin API', () => {
  it('is forbidden for non-admin users', async () => {
    // Register a filler user first so 'notadmin' isn't the first-ever
    // account (which would auto-promote to admin).
    await register(request.agent(app), 'filler-admin@example.com');

    const agent = request.agent(app);
    await register(agent, 'notadmin@example.com');
    const res = await agent.get('/api/admin/users');
    expect(res.statusCode).toBe(403);
  });

  it('lets an admin manage users and todos', async () => {
    const admin = request.agent(app);
    await register(admin, 'admin@example.com');

    const memberAgent = request.agent(app);
    const member = await register(memberAgent, 'member@example.com');
    await memberAgent.post('/api/todos').send({ title: "member's todo" });

    const users = await admin.get('/api/admin/users');
    expect(users.statusCode).toBe(200);
    expect(users.body.items).toHaveLength(2);

    const promote = await admin
      .patch(`/api/admin/users/${member.body.id}`)
      .send({ role: 'admin' });
    expect(promote.statusCode).toBe(200);
    expect(promote.body.role).toBe('admin');

    const deactivate = await admin
      .patch(`/api/admin/users/${member.body.id}`)
      .send({ active: false });
    expect(deactivate.statusCode).toBe(200);
    expect(deactivate.body.active).toBe(false);

    const lockedOut = await memberAgent.get('/api/auth/me');
    expect(lockedOut.statusCode).toBe(401);

    const allTodos = await admin.get('/api/admin/todos');
    expect(allTodos.statusCode).toBe(200);
    expect(allTodos.body.items).toHaveLength(1);
    expect(allTodos.body.items[0].user.email).toBe('member@example.com');

    const deleteTodo = await admin.delete(`/api/admin/todos/${allTodos.body.items[0]._id}`);
    expect(deleteTodo.statusCode).toBe(204);

    const deleteUser = await admin.delete(`/api/admin/users/${member.body.id}`);
    expect(deleteUser.statusCode).toBe(204);

    const usersAfter = await admin.get('/api/admin/users');
    expect(usersAfter.body.items).toHaveLength(1);
  });

  it('supports searching users and todos', async () => {
    const admin = request.agent(app);
    await register(admin, 'searchadmin@example.com');

    const alice = request.agent(app);
    await register(alice, 'alice@example.com', 'password123', 'Alice Anderson');
    await alice.post('/api/todos').send({ title: 'Plan the roadmap' });

    const bob = request.agent(app);
    await register(bob, 'bob@example.com', 'password123', 'Bob Brown');
    await bob.post('/api/todos').send({ title: 'Fix the bug' });

    const userSearch = await admin.get('/api/admin/users').query({ search: 'Alice' });
    expect(userSearch.body.items).toHaveLength(1);
    expect(userSearch.body.items[0].fullName).toBe('Alice Anderson');

    const todoSearchByTitle = await admin.get('/api/admin/todos').query({ search: 'bug' });
    expect(todoSearchByTitle.body.items).toHaveLength(1);
    expect(todoSearchByTitle.body.items[0].user.fullName).toBe('Bob Brown');

    const todoSearchByUser = await admin.get('/api/admin/todos').query({ search: 'Alice' });
    expect(todoSearchByUser.body.items).toHaveLength(1);
    expect(todoSearchByUser.body.items[0].title).toBe('Plan the roadmap');
  });

  it('supports filtering users and todos by created-date range', async () => {
    const admin = request.agent(app);
    await register(admin, 'daterangeadmin@example.com');

    const member = request.agent(app);
    const memberUser = await register(member, 'daterangemember@example.com');
    const oldTodo = await member.post('/api/todos').send({ title: 'Old admin-visible todo' });
    await member.post('/api/todos').send({ title: 'New admin-visible todo' });

    await Todo.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(oldTodo.body._id) },
      { $set: { createdAt: new Date('2020-01-01T00:00:00Z') } }
    );
    await User.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(memberUser.body.id) },
      { $set: { createdAt: new Date('2020-01-01T00:00:00Z') } }
    );

    const recentUsers = await admin.get('/api/admin/users').query({ dateFrom: '2025-01-01' });
    expect(recentUsers.body.items.map((u) => u.email)).not.toContain('daterangemember@example.com');

    const recentTodos = await admin.get('/api/admin/todos').query({ dateFrom: '2025-01-01' });
    expect(recentTodos.body.items).toHaveLength(1);
    expect(recentTodos.body.items[0].title).toBe('New admin-visible todo');
  });

  it('provides aggregate stats for users and todos', async () => {
    const admin = request.agent(app);
    await register(admin, 'statsadmin@example.com');

    const alice = request.agent(app);
    await register(alice, 'alicestats@example.com', 'password123', 'Alice Stats');
    const t1 = await alice.post('/api/todos').send({ title: 'Task one' });
    await alice.post('/api/todos').send({ title: 'Task two' });
    await alice.patch(`/api/todos/${t1.body._id}`).send({ done: true });

    const bob = request.agent(app);
    const bobUser = await register(bob, 'bobstats@example.com', 'password123', 'Bob Stats');
    await bob.post('/api/todos').send({ title: 'Bob task' });

    await admin.patch(`/api/admin/users/${bobUser.body.id}`).send({ active: false });

    const forbidden = await alice.get('/api/admin/stats');
    expect(forbidden.statusCode).toBe(403);

    const stats = await admin.get('/api/admin/stats');
    expect(stats.statusCode).toBe(200);
    expect(stats.body.users).toEqual({ total: 3, active: 2, inactive: 1, admins: 1, regular: 2 });
    expect(stats.body.todos).toEqual({ total: 3, done: 1, pending: 2 });
    expect(stats.body.topUsers[0]).toMatchObject({
      fullName: 'Alice Stats',
      todoCount: 2,
      doneCount: 1,
    });
  });

  it('blocks an admin from demoting, deactivating, or deleting themselves', async () => {
    const admin = request.agent(app);
    const me = await register(admin, 'soleadmin@example.com');

    const demoteSelf = await admin
      .patch(`/api/admin/users/${me.body.id}`)
      .send({ role: 'user' });
    expect(demoteSelf.statusCode).toBe(400);

    const deactivateSelf = await admin
      .patch(`/api/admin/users/${me.body.id}`)
      .send({ active: false });
    expect(deactivateSelf.statusCode).toBe(400);

    const deleteSelf = await admin.delete(`/api/admin/users/${me.body.id}`);
    expect(deleteSelf.statusCode).toBe(400);
  });
});
