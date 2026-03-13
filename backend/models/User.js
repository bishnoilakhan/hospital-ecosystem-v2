// User model for authentication and role-based access
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ["patient", "doctor", "receptionist", "admin"],
      default: "patient"
    },
    active: {
      type: Boolean,
      default: true
    },
    healthId: {
      type: String,
      required: false,
      unique: true,
      sparse: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
