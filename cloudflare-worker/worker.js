const APP_URL = 'https://canturi-training-studio.vercel.app';

export default {
  async scheduled(event, env, ctx) {
    const trigger = event.cron;

    if (trigger === '0 13 * * *') {
      // Midnight AEST (UTC+11) = 13:00 UTC
      ctx.waitUntil(
        fetch(`${APP_URL}/api/rollover`, { method: 'POST' })
          .then(r => r.json())
          .then(data => console.log('Rollover:', JSON.stringify(data)))
          .catch(err => console.error('Rollover failed:', err))
      );
    }

    if (trigger === '0 21 * * *') {
      // 8am AEST (UTC+11) = 21:00 UTC previous day
      ctx.waitUntil(
        fetch(`${APP_URL}/api/daily-digest`, { method: 'POST' })
          .then(r => r.json())
          .then(data => console.log('Daily digest:', JSON.stringify(data)))
          .catch(err => console.error('Daily digest failed:', err))
      );
    }
  },
};
