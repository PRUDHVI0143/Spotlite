// -------------------------------------------------------------
// SPOTLITE AI CONTENT MODERATION MIDDLEWARE
// Filters spam, abuse, and prohibited keywords before posting
// -------------------------------------------------------------

const PROHIBITED_KEYWORDS = [
  'spam', 'scam', 'phishing', 'fakefollower', 'buyfollowers',
  'hate', 'abusive_term_example'
];

function checkContentModeration(req, res, next) {
  const textToCheck = `${req.body.caption || ''} ${req.body.text || ''}`.toLowerCase();
  
  for (const keyword of PROHIBITED_KEYWORDS) {
    if (textToCheck.includes(keyword)) {
      return res.status(400).json({ 
        error: `Content flagged by Spotlite AI Safety Filter: Contains prohibited or spam keyword ("${keyword}").` 
      });
    }
  }
  next();
}

module.exports = { checkContentModeration };
