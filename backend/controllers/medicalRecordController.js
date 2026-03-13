// Medical record controller for the Digital Medical Vault
const { isValidObjectId } = require("mongoose");
const MedicalRecord = require("../models/MedicalRecord");
const Doctor = require("../models/Doctor");
const User = require("../models/User");
const Patient = require("../models/Patient");

const addMedicalRecord = async (req, res) => {
  try {
    const { patientHealthId, diagnosis, prescription, notes = "", reports = [] } = req.body;

    if (!patientHealthId || !diagnosis || !prescription) {
      return res
        .status(400)
        .json({ message: "patientHealthId, diagnosis, and prescription are required" });
    }
    if (Array.isArray(prescription) && prescription.length === 0) {
      return res
        .status(400)
        .json({ message: "patientHealthId, diagnosis, and prescription are required" });
    }

    if (!isValidObjectId(req.user.id)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const doctor = await Doctor.findOne({ userId: req.user.id });
    if (!doctor) {
      return res.status(404).json({ message: "Doctor profile not found" });
    }

    const patient = await Patient.findOne({ healthId: patientHealthId }).select("healthId");
    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }

    const record = await MedicalRecord.create({
      patientHealthId,
      doctorId: doctor._id,
      diagnosis,
      prescription,
      notes,
      reports
    });

    return res.status(201).json({
      message: "Medical record added",
      record
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to add medical record", error: error.message });
  }
};

const getPatientRecords = async (req, res) => {
  try {
    let { patientHealthId } = req.query;

    if (req.user.role === "patient") {
      if (!isValidObjectId(req.user.id)) {
        return res.status(400).json({ message: "Invalid id" });
      }

      const user = await User.findById(req.user.id).select("healthId");
      if (!user || !user.healthId) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (patientHealthId && user.healthId !== patientHealthId) {
        return res.status(403).json({ message: "Access denied" });
      }
      patientHealthId = user.healthId;
    } else if (!patientHealthId) {
      return res.status(400).json({ message: "patientHealthId is required" });
    }

    const records = await MedicalRecord.find({ patientHealthId }).sort({ date: -1 });

    return res.status(200).json({
      message: "Medical records fetched",
      records
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch medical records", error: error.message });
  }
};

module.exports = {
  addMedicalRecord,
  getPatientRecords
};
