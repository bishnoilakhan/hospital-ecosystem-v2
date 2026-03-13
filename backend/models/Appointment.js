// Appointment model to link patients with doctors
const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    patientHealthId: {
      type: String,
      required: true,
      trim: true
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true
    },
    date: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: ["scheduled", "checked-in", "completed"],
      default: "scheduled"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Appointment", appointmentSchema);
