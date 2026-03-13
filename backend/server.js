// Entry point for the Hospital Ecosystem API
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { initSocket } = require("./socket");

const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const patientRoutes = require("./routes/patientRoutes");
const doctorRoutes = require("./routes/doctorRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const medicalRecordRoutes = require("./routes/medicalRecordRoutes");
const triageRoutes = require("./routes/triageRoutes");
const adminRoutes = require("./routes/adminRoutes");
const statsRoutes = require("./routes/statsRoutes");

dotenv.config();

const app = express();

// Middleware: JSON parsing and CORS
app.use(express.json());
app.use(cors());

// Connect to MongoDB
connectDB();

// Test route
app.get("/api/test", (req, res) => {
  res.status(200).send("Hospital Ecosystem API Running");
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api", doctorRoutes);
app.use("/api", appointmentRoutes);
app.use("/api", medicalRecordRoutes);
app.use("/api", triageRoutes);
app.use("/api", adminRoutes);
app.use("/api", statsRoutes);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

initSocket(server);
