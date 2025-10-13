module.exports = (req, res) => {
  try {
    res.setHeader('Content-Type', 'application/json');
    res.status(200).end(JSON.stringify({
      status: 'OK',
      timestamp: new Date().toISOString(),
      env: {
        JUSO_API_KEY: !!process.env.JUSO_API_KEY,
        NODE_ENV: process.env.NODE_ENV || null,
      }
    }));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'health handler error', message: String(e && e.message || e) }));
  }
};

