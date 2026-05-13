const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/projects', projectController.listProjects);
router.get('/project/:id', projectController.getProject);
router.post('/save-project', projectController.saveProject);
router.delete('/delete-project/:id', projectController.deleteProject);

module.exports = router;
