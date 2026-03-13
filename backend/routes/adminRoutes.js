// Admin routes
const express = require("express");
const {
  createStaffUser,
  getSystemStats,
  getUsers,
  updateUser,
  getAuditLogs
} = require("../controllers/adminController");
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

router.post("/admin/create-staff", protect, authorizeRoles("admin"), createStaffUser);
router.get("/admin/stats", protect, authorizeRoles("admin"), getSystemStats);
router.get("/admin/users", protect, authorizeRoles("admin"), getUsers);
router.put("/admin/users/:id", protect, authorizeRoles("admin"), updateUser);
router.get("/admin/audit-logs", protect, authorizeRoles("admin"), getAuditLogs);

module.exports = router;
