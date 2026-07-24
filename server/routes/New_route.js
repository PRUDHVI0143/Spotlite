const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.send('New route');
});

module.exports = router;
