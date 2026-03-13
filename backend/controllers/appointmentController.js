// Appointment controller for scheduling and lifecycle updates
const { isValidObjectId } = require("mongoose");
const Appointment = require("../models/Appointment");
const Doctor = require("../models/Doctor");
const User = require("../models/User");
const Patient = require("../models/Patient");
const { getIO } = require("../socket");

const createAppointment = async (req, res) => {
  try {
    const { patientHealthId, doctorId, date } = req.body;

    if (!doctorId || !date) {
      return res.status(400).json({ message: "doctorId and date are required" });
    }

    if (req.user.role !== "patient" && !patientHealthId) {
      return res.status(400).json({ message: "patientHealthId is required" });
    }

    if (!isValidObjectId(doctorId)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    let resolvedPatientHealthId = patientHealthId;

    if (req.user.role === "patient") {
      if (!isValidObjectId(req.user.id)) {
        return res.status(400).json({ message: "Invalid id" });
      }

      const user = await User.findById(req.user.id).select("healthId");
      if (!user || !user.healthId) {
        return res.status(403).json({ message: "Access denied" });
      }

      resolvedPatientHealthId = user.healthId;
      if (patientHealthId && patientHealthId !== user.healthId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const patient = await Patient.findOne({ healthId: user.healthId }).select("healthId");
      if (!patient || patient.healthId !== user.healthId) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    if (req.user.role !== "patient") {
      const patient = await Patient.findOne({ healthId: resolvedPatientHealthId }).select(
        "healthId"
      );
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }
    }

    const appointmentDate = new Date(date);
    if (isNaN(appointmentDate.getTime())) {
      return res.status(400).json({ message: "Invalid appointment date" });
    }

    if (appointmentDate < new Date()) {
      return res.status(400).json({ message: "Appointment date must be in the future" });
    }

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    const appointment = await Appointment.create({
      patientHealthId: resolvedPatientHealthId,
      doctorId,
      date,
      status: "scheduled"
    });

    return res.status(201).json({
      message: "Appointment created",
      appointment
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create appointment", error: error.message });
  }
};

const getDoctorAppointments = async (req, res) => {
  try {
    if (!isValidObjectId(req.user.id)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const doctor = await Doctor.findOne({ userId: req.user.id });
    if (!doctor) {
      return res.status(404).json({ message: "Doctor profile not found" });
    }

    const appointments = await Appointment.find({ doctorId: doctor._id })
      .populate({
        path: "doctorId",
        populate: { path: "userId", model: "User", select: "name" }
      })
      .select("patientHealthId status date doctorId");
    const healthIds = appointments.map((appointment) => appointment.patientHealthId).filter(Boolean);
    const patients = await Patient.find({ healthId: { $in: healthIds } }).select(
      "healthId name age bloodGroup phone"
    );
    const patientByHealthId = patients.reduce((acc, patient) => {
      acc[patient.healthId] = patient;
      return acc;
    }, {});

    const formatted = appointments.map((appointment) => ({
      _id: appointment._id,
      date: appointment.date,
      status: appointment.status,
      doctorName: appointment.doctorId?.userId?.name || "Unknown",
      department: appointment.doctorId?.department || "N/A",
      patient: {
        healthId: appointment.patientHealthId,
        name: patientByHealthId[appointment.patientHealthId]?.name || "Unknown",
        age: patientByHealthId[appointment.patientHealthId]?.age || "N/A",
        bloodGroup: patientByHealthId[appointment.patientHealthId]?.bloodGroup || "N/A",
        phone: patientByHealthId[appointment.patientHealthId]?.phone || "N/A"
      }
    }));

    return res.status(200).json({
      message: "Doctor appointments fetched",
      appointments: formatted
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch appointments", error: error.message });
  }
};

const checkInPatient = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    const appointment = await Appointment.findById(id);

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    if (appointment.status !== "scheduled") {
      return res.status(400).json({ message: "Appointment cannot be checked-in" });
    }

    appointment.status = "checked-in";
    await appointment.save();

    const io = getIO();
    io.emit("patientCheckedIn", {
      appointmentId: appointment._id,
      patientHealthId: appointment.patientHealthId,
      doctorId: appointment.doctorId
    });

    return res.status(200).json({
      message: "Patient checked in",
      appointment
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to check in patient", error: error.message });
  }
};

const completeAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    const appointment = await Appointment.findById(id);

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    if (appointment.status !== "checked-in") {
      return res
        .status(400)
        .json({ message: "Appointment must be checked-in before completion" });
    }

    appointment.status = "completed";
    await appointment.save();

    return res.status(200).json({
      message: "Appointment completed",
      appointment
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to complete appointment", error: error.message });
  }
};

const getTodayAppointments = async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const appointments = await Appointment.find({
      date: { $gte: todayStart, $lte: todayEnd }
    })
      .populate({
        path: "doctorId",
        select: "department userId",
        populate: { path: "userId", select: "name" }
      })
      .select("patientHealthId date status doctorId");

    const healthIds = appointments.map((appointment) => appointment.patientHealthId).filter(Boolean);
    const patients = await Patient.find({ healthId: { $in: healthIds } }).select(
      "healthId name age bloodGroup phone"
    );
    const patientMap = {};
    patients.forEach((patient) => {
      patientMap[patient.healthId] = patient;
    });

    const formatted = appointments.map((appointment) => {
      const patient = patientMap[appointment.patientHealthId];
      return {
        _id: appointment._id,
        patientName: patient?.name || "Unknown",
        patientHealthId: appointment.patientHealthId,
        doctorName: appointment.doctorId?.userId?.name || "Unknown",
        doctorId: appointment.doctorId?._id,
        time: appointment.date,
        status: appointment.status
      };
    });

    return res.status(200).json({ appointments: formatted });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to fetch today's appointments", error: error.message });
  }
};

const getPatientAppointments = async (req, res) => {
  try {
    if (!isValidObjectId(req.user.id)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const user = await User.findById(req.user.id).select("healthId");
    if (!user || !user.healthId) {
      return res.status(404).json({ message: "Patient profile not found" });
    }

    const appointments = await Appointment.find({ patientHealthId: user.healthId })
      .sort({ date: -1 })
      .populate({
        path: "doctorId",
        select: "department userId",
        populate: { path: "userId", select: "name" }
      })
      .select("date status doctorId");

    const formatted = appointments.map((appointment) => ({
      doctorName: appointment.doctorId?.userId?.name || "Unknown",
      department: appointment.doctorId?.department || "N/A",
      date: appointment.date,
      status: appointment.status
    }));

    return res.status(200).json({ appointments: formatted });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch patient appointments",
      error: error.message
    });
  }
};

module.exports = {
  createAppointment,
  getDoctorAppointments,
  checkInPatient,
  completeAppointment,
  getTodayAppointments,
  getPatientAppointments
};
