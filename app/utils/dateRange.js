function parseDateRange(query, field = 'createdAt') {
  const range = {};

  if (query.dateFrom) {
    const from = new Date(query.dateFrom);
    if (!Number.isNaN(from.getTime())) range.$gte = from;
  }

  if (query.dateTo) {
    const to = new Date(query.dateTo);
    if (!Number.isNaN(to.getTime())) {
      to.setHours(23, 59, 59, 999);
      range.$lte = to;
    }
  }

  return Object.keys(range).length ? { [field]: range } : {};
}

module.exports = parseDateRange;
