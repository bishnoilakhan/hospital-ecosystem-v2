import { useEffect, useState } from "react";
import {
  createAppointment,
  checkInPatient,
  getReceptionStats,
  getDoctors,
  registerPatientByReception,
  searchPatients,
  getTodayAppointments
} from "../services/api";
import DashboardLayout from "../components/DashboardLayout";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import StatsCard from "../components/StatsCard";
import StatsSkeleton from "../components/StatsSkeleton";
import { formatDepartment, formatDoctorName, formatName } from "../utils/format";

const ReceptionDashboard = () => {
  const { token } = useAuth();
  const [patientQuery, setPatientQuery] = useState("");
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [appointmentForm, setAppointmentForm] = useState({
    patientHealthId: "",
    doctorId: "",
    date: ""
  });
  const [doctorQuery, setDoctorQuery] = useState("");
  const [doctors, setDoctors] = useState([]);
  const [doctorSuggestions, setDoctorSuggestions] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    name: "",
    age: "",
    gender: "",
    bloodGroup: "",
    phone: ""
  });
  const [stats, setStats] = useState({
    totalAppointments: "—",
    appointmentsToday: "—",
    checkedIn: "—",
    waiting: "—"
  });
  const [statsLoading, setStatsLoading] = useState(true);

  const fetchStats = async () => {
    if (!token) return;
    setStatsLoading(true);
    try {
      const data = await getReceptionStats(token);
      setStats({
        totalAppointments: data.totalAppointments,
        appointmentsToday: data.appointmentsToday,
        checkedIn: data.checkedIn,
        waiting: data.waiting
      });
    } catch (error) {
      toast.error("Failed to load stats");
    } finally {
      setStatsLoading(false);
    }
  };

  const handleSearch = async (query) => {
    setSearchLoading(true);
    try {
      if (!query.trim()) {
        setPatients([]);
        return;
      }
      const data = await searchPatients(token, query);
      setPatients(data.patients || []);
    } catch (error) {
      toast.error("Failed to fetch patient");
    } finally {
      setSearchLoading(false);
    }
  };

  const fetchDoctors = async () => {
    if (!token) return;
    try {
      const data = await getDoctors(token);
      setDoctors(data.doctors || []);
    } catch (error) {
      toast.error("Failed to load doctors");
    }
  };

  const fetchTodayAppointments = async () => {
    if (!token) return;
    try {
      const data = await getTodayAppointments(token);
      setTodayAppointments(data.appointments || []);
    } catch (error) {
      toast.error("Failed to load today's appointments");
    }
  };

  const handleAppointmentChange = (event) => {
    setAppointmentForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const handleCreateAppointment = async (event) => {
    if (event?.preventDefault) {
      event.preventDefault();
    }
    if (!selectedPatient || !selectedDoctor || !appointmentForm.date) {
      toast.error("Select patient, doctor, and date");
      return;
    }
    setCreating(true);
    try {
      const payload = {
        patientHealthId: appointmentForm.patientHealthId,
        doctorId: appointmentForm.doctorId,
        date: new Date(appointmentForm.date).toISOString()
      };
      const data = await createAppointment(payload, token);
      toast.success("Appointment created successfully");
      fetchStats();
      fetchTodayAppointments();
    } catch (error) {
      toast.error("Something went wrong");
    } finally {
      setCreating(false);
    }
  };

  const handleRegisterChange = (event) => {
    const { name, value } = event.target;
    const nextValue = name === "bloodGroup" ? value.toUpperCase() : value;
    setRegisterForm((prev) => ({ ...prev, [name]: nextValue }));
  };

  const handleRegisterPatient = async (event) => {
    event.preventDefault();
    const { name, age, gender, bloodGroup, phone } = registerForm;
    if (!name || !age || !gender || !bloodGroup || !phone) {
      toast.error("Missing required fields");
      return;
    }
    setRegistering(true);
    try {
      const payload = {
        name,
        age: Number(age),
        gender,
        bloodGroup,
        phone
      };
      const data = await registerPatientByReception(payload, token);
      const patientData = data.patient || { name, healthId: data.healthId, phone };
      const healthId = patientData.healthId;
      toast.success("Patient registered");
      setSelectedPatient({
        name: patientData.name,
        healthId,
        phone: patientData.phone || phone
      });
      setPatientQuery(formatName(patientData.name || ""));
      setPatients([]);
      setAppointmentForm((prev) => ({
        ...prev,
        patientHealthId: healthId
      }));
      setRegisterForm({
        name: "",
        age: "",
        gender: "",
        bloodGroup: "",
        phone: ""
      });
    } catch (error) {
      toast.error("Registration failed");
    } finally {
      setRegistering(false);
    }
  };

  const handleCheckInAppointment = async (appointmentId) => {
    setCheckingIn(true);
    try {
      await checkInPatient(appointmentId, token);
      toast.success("Patient checked in");
      fetchStats();
      fetchTodayAppointments();
    } catch (error) {
      toast.error("Something went wrong");
    } finally {
      setCheckingIn(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchDoctors();
    fetchTodayAppointments();
  }, [token]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (patientQuery.trim().length > 2) {
        handleSearch(patientQuery);
      } else {
        setPatients([]);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [patientQuery]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (doctorQuery.trim().length > 2) {
        const filtered = doctors.filter(
          (doctor) =>
            doctor.name?.toLowerCase().includes(doctorQuery.toLowerCase()) ||
            doctor.department?.toLowerCase().includes(doctorQuery.toLowerCase())
        );
        setDoctorSuggestions(filtered);
      } else {
        setDoctorSuggestions([]);
      }
    }, 200);
    return () => clearTimeout(timeout);
  }, [doctorQuery, doctors]);

  const handleSelectPatient = (patient) => {
    setSelectedPatient(patient);
    setPatientQuery(formatName(patient.name || ""));
    setAppointmentForm((prev) => ({
      ...prev,
      patientHealthId: patient.healthId
    }));
    setPatients([]);
  };

  const handleSelectDoctor = (doctor) => {
    setSelectedDoctor(doctor);
    setDoctorQuery(
      `${formatDoctorName(doctor.name || "")} - ${formatDepartment(doctor.department || "")}`
    );
    setAppointmentForm((prev) => ({
      ...prev,
      doctorId: doctor._id
    }));
    setDoctorSuggestions([]);
  };

  const clearSelectedPatient = () => {
    setSelectedPatient(null);
    setPatientQuery("");
    setPatients([]);
    setAppointmentForm((prev) => ({ ...prev, patientHealthId: "" }));
  };

  const clearSelectedDoctor = () => {
    setSelectedDoctor(null);
    setDoctorQuery("");
    setDoctorSuggestions([]);
    setAppointmentForm((prev) => ({ ...prev, doctorId: "" }));
  };

  const formatTime = (value) =>
    new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const getStatusStyle = (status) => {
    switch (status) {
      case "scheduled":
        return "bg-gray-100 text-gray-700";
      case "checked-in":
        return "bg-yellow-100 text-yellow-700";
      case "completed":
        return "bg-green-100 text-green-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <DashboardLayout title="Reception Dashboard">
      <div className="container mx-auto grid gap-6">
        {!token && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Please log in as a receptionist to manage appointments.
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {statsLoading ? (
            <>
              <StatsSkeleton />
              <StatsSkeleton />
              <StatsSkeleton />
              <StatsSkeleton />
            </>
          ) : (
            <>
              <StatsCard title="Total Appointments" value={stats.totalAppointments} />
              <StatsCard title="Appointments Today" value={stats.appointmentsToday} />
              <StatsCard title="Checked-In Patients" value={stats.checkedIn} />
              <StatsCard title="Waiting Patients" value={stats.waiting} />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-3">Search Patient</h2>
            <div className="grid gap-3">
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Search patient by name or health ID"
                value={patientQuery}
                onChange={(event) => setPatientQuery(event.target.value)}
              />
              <div className="border rounded-lg p-3">
                {searchLoading ? (
                  <div className="text-sm text-gray-500">Searching...</div>
                ) : patients.length === 0 ? (
                  <div className="text-sm text-gray-500">
                    {patientQuery.length > 2 ? "No patients found." : "Start typing to search."}
                  </div>
                ) : (
                  patients.map((patient) => (
                    <button
                      key={patient.healthId}
                      type="button"
                      onClick={() => handleSelectPatient(patient)}
                      className="flex w-full items-center justify-between py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <span className="font-medium">{formatName(patient.name || "Unknown")}</span>
                      <span className="text-xs text-gray-500">{patient.healthId}</span>
                    </button>
                  ))
                )}
              </div>
              {selectedPatient && (
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                  <span>
                    Selected:{" "}
                    <span className="font-semibold text-slate-800">
                      {formatName(selectedPatient.name || "Unknown")}
                    </span>{" "}
                    — {selectedPatient.healthId}
                  </span>
                  <button
                    type="button"
                    className="text-xs font-semibold text-blue-600 hover:underline"
                    onClick={clearSelectedPatient}
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-3">Register Walk-in Patient</h2>
            <form onSubmit={handleRegisterPatient} className="grid gap-3">
              <input
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Full name"
                name="name"
                value={registerForm.name}
                onChange={handleRegisterChange}
                required
              />
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Age"
                  name="age"
                  type="number"
                  min="0"
                  value={registerForm.age}
                  onChange={handleRegisterChange}
                  required
                />
                <input
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Gender"
                  name="gender"
                  value={registerForm.gender}
                  onChange={handleRegisterChange}
                  required
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Blood Group"
                  name="bloodGroup"
                  value={registerForm.bloodGroup}
                  onChange={handleRegisterChange}
                  required
                />
                <input
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Phone"
                  name="phone"
                  value={registerForm.phone}
                  onChange={handleRegisterChange}
                  required
                />
              </div>
              <button
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                disabled={registering}
              >
                {registering ? (
                  <div className="mx-auto h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                ) : (
                  "Register Patient"
                )}
              </button>
            </form>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-3">Create Appointment</h2>
          <div className="grid gap-3">
            <div className="text-sm text-slate-600">
              Patient:{" "}
              <span className="font-semibold text-slate-800">
                {selectedPatient ? formatName(selectedPatient.name) : "Not selected"}
              </span>
            </div>
            <div className="relative">
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Search doctor by name or department"
                value={doctorQuery}
                onChange={(event) => setDoctorQuery(event.target.value)}
              />
              {doctorSuggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded border border-slate-200 bg-white shadow">
                  {doctorSuggestions.map((doctor) => (
                    <button
                      key={doctor._id}
                      type="button"
                      onClick={() => handleSelectDoctor(doctor)}
                      className="block w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-gray-100"
                    >
                      {formatDoctorName(doctor.name || "Unknown")} —{" "}
                      {formatDepartment(doctor.department || "N/A")}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedDoctor && (
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                <span>
                  Selected Doctor:{" "}
                  <span className="font-semibold text-slate-800">
                    {formatDoctorName(selectedDoctor.name || "Unknown")}
                  </span>{" "}
                  — {formatDepartment(selectedDoctor.department || "N/A")}
                </span>
                <button
                  type="button"
                  className="text-xs font-semibold text-blue-600 hover:underline"
                  onClick={clearSelectedDoctor}
                >
                  Clear
                </button>
              </div>
            )}
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              type="datetime-local"
              name="date"
              value={appointmentForm.date}
              onChange={handleAppointmentChange}
              required
            />
            <button
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                !selectedPatient || !selectedDoctor
                  ? "cursor-not-allowed bg-gray-300 text-gray-600"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
              disabled={creating || !selectedPatient || !selectedDoctor}
              onClick={handleCreateAppointment}
              type="button"
            >
              {creating ? (
                <div className="mx-auto h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
              ) : (
                "Create Appointment"
              )}
            </button>
            {!selectedPatient || !selectedDoctor ? (
              <p className="text-xs text-slate-500">Select patient and doctor to continue.</p>
            ) : null}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Today's Queue</h2>
          {todayAppointments.length === 0 ? (
            <p className="text-sm text-slate-500">No appointments scheduled today.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-slate-500">
                    <th className="py-2">Time</th>
                    <th className="py-2">Patient</th>
                    <th className="py-2">Doctor</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {todayAppointments.map((appointment) => (
                    <tr key={appointment._id} className="border-b last:border-b-0">
                      <td className="py-2">{formatTime(appointment.time)}</td>
                      <td className="py-2">{formatName(appointment.patientName || "Unknown")}</td>
                      <td className="py-2">
                        {formatDoctorName(appointment.doctorName || "Unknown")}
                      </td>
                      <td className="py-2">
                        <span
                          className={`px-2 py-1 rounded text-xs ${getStatusStyle(
                            appointment.status
                          )}`}
                        >
                          {appointment.status}
                        </span>
                      </td>
                      <td className="py-2">
                        <button
                          className={`rounded px-3 py-1 text-xs font-semibold ${
                            appointment.status !== "scheduled"
                              ? "cursor-not-allowed bg-gray-200 text-gray-500"
                              : "bg-blue-600 text-white hover:bg-blue-700"
                          }`}
                          disabled={checkingIn || appointment.status !== "scheduled"}
                          onClick={() => handleCheckInAppointment(appointment._id)}
                          type="button"
                        >
                          {checkingIn ? "Checking..." : "Check-in"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ReceptionDashboard;
