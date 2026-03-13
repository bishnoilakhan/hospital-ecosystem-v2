import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import {
  addMedicalRecord,
  completeAppointment,
  getDoctorStats,
  getPatientRecords,
  searchPatients
} from "../services/api";
import DashboardLayout from "../components/DashboardLayout";
import DashboardCard from "../components/DashboardCard";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import StatsCard from "../components/StatsCard";
import StatsSkeleton from "../components/StatsSkeleton";
import {
  formatDepartment,
  formatLabel,
  formatMedicine,
  formatName
} from "../utils/format";

const API_BASE_URL = "http://localhost:5001/api";

const DoctorDashboard = () => {
  const { token } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [currentPatient, setCurrentPatient] = useState(null);
  const [consultationMode, setConsultationMode] = useState(false);
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [medicines, setMedicines] = useState([]);
  const [medicineForm, setMedicineForm] = useState({
    medicine: "",
    dose: "",
    frequency: "",
    duration: ""
  });
  const [records, setRecords] = useState([]);
  const [showRecords, setShowRecords] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [submittingRecord, setSubmittingRecord] = useState(false);
  const [completingId, setCompletingId] = useState(null);
  const [stats, setStats] = useState({
    todaysAppointments: "—",
    completedToday: "—",
    totalPatients: "—"
  });
  const [statsLoading, setStatsLoading] = useState(true);

  const today = new Date();
  const todayDateString = today.toDateString();
  const todaysAppointments = appointments.filter(
    (appointment) => new Date(appointment.date).toDateString() === todayDateString
  );
  const upcomingAppointments = appointments.filter(
    (appointment) =>
      new Date(appointment.date) > today &&
      new Date(appointment.date).toDateString() !== todayDateString
  );
  const pastAppointments = appointments.filter(
    (appointment) => new Date(appointment.date) < today
  );
  const sortedPastAppointments = [...pastAppointments].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );
  const todaysAppointmentsSorted = [...todaysAppointments].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

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

  const formatTime = (date) =>
    date
      ? new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "Time not set";

  const fetchAppointments = async () => {
    setRefreshing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/doctor/appointments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Failed to fetch appointments");
      setAppointments(data.appointments || []);
      fetchStats();
      return data.appointments || [];
    } catch (error) {
      toast.error("Something went wrong");
      return [];
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchAppointments();
      fetchStats();
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    if (search.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const fetchResults = async () => {
      try {
        const data = await searchPatients(token, search.trim());
        setSearchResults(data.patients || []);
      } catch (error) {
        toast.error("Failed to load patients");
      }
    };

    fetchResults();
  }, [search, token]);

  useEffect(() => {
    if (consultationMode || !appointments.length) return;
    const checkedInPatient = appointments.find(
      (appointment) => appointment.status === "checked-in"
    );
    setCurrentPatient(checkedInPatient || null);
  }, [appointments, consultationMode]);

  useEffect(() => {
    const socket = io("http://localhost:5001");

    socket.on("patientCheckedIn", () => {
      fetchAppointments();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleAddRecord = async (event) => {
    event.preventDefault();
    if (!selectedAppointment) {
      toast.error("Select an appointment to start consultation");
      return;
    }
    setSubmittingRecord(true);
    try {
      const payload = {
        patientHealthId: selectedAppointment.patient?.healthId,
        diagnosis,
        prescription: medicines,
        notes
      };
      const data = await addMedicalRecord(payload, token);
      toast.success("Medical record added");
      setDiagnosis("");
      setNotes("");
      setMedicines([]);
      setMedicineForm({ medicine: "", dose: "", frequency: "", duration: "" });
    } catch (error) {
      toast.error("Something went wrong");
    } finally {
      setSubmittingRecord(false);
    }
  };

  const handleMedicineChange = (event) => {
    setMedicineForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const handleAddMedicine = () => {
    if (!medicineForm.medicine) return;
    setMedicines((prev) => [...prev, medicineForm]);
    setMedicineForm({ medicine: "", dose: "", frequency: "", duration: "" });
  };

  const removeMedicine = (index) => {
    setMedicines((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleOpenConsultation = (appointment) => {
    setSelectedAppointment(appointment);
    setCurrentPatient(appointment);
    setConsultationMode(true);
    setDiagnosis("");
    setNotes("");
    setMedicines([]);
    setMedicineForm({ medicine: "", dose: "", frequency: "", duration: "" });
  };

  const handleCompleteAppointment = async (appointmentId) => {
    if (!appointmentId) return;
    setCompletingId(appointmentId);
    try {
      await completeAppointment(appointmentId, token);
      toast.success("Appointment completed");
      setAppointments((prev) =>
        prev.map((appointment) =>
          appointment._id === appointmentId
            ? { ...appointment, status: "completed" }
            : appointment
        )
      );
      fetchStats();
    } catch (error) {
      toast.error("Something went wrong");
    } finally {
      setCompletingId(null);
    }
  };

  const handleCompleteConsultation = async () => {
    if (!currentPatient?._id) return;
    try {
      await completeAppointment(currentPatient._id, token);
      const updatedAppointments = await fetchAppointments();
      const nextPatient = updatedAppointments.find(
        (appointment) => appointment.status === "checked-in"
      );
      toast.success("Consultation completed");
      setSelectedAppointment(null);
      setConsultationMode(false);
      if (nextPatient) {
        setCurrentPatient(nextPatient);
      } else {
        setCurrentPatient(null);
      }
    } catch (error) {
      toast.error("Failed to complete consultation");
    }
  };

  const handleExitConsultation = () => {
    setConsultationMode(false);
    setCurrentPatient(null);
  };

  const handleViewRecord = async (healthId) => {
    if (!healthId) return;
    try {
      const data = await getPatientRecords(token, healthId);
      setRecords(data.records || []);
      setShowRecords(true);
    } catch (error) {
      toast.error("Failed to load medical records");
    }
  };

  const fetchStats = async () => {
    if (!token) return;
    setStatsLoading(true);
    try {
      const data = await getDoctorStats(token);
      setStats({
        todaysAppointments: data.todaysAppointments,
        completedToday: data.completedToday,
        totalPatients: data.totalPatients
      });
    } catch (error) {
      toast.error("Failed to load stats");
    } finally {
      setStatsLoading(false);
    }
  };

  return (
    <DashboardLayout title="Doctor Dashboard">
      <div className="container mx-auto space-y-6">
        {!token && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Please log in as a doctor to view appointments and add records.
          </div>
        )}

        {!consultationMode && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {statsLoading ? (
              <>
                <StatsSkeleton />
                <StatsSkeleton />
                <StatsSkeleton />
              </>
            ) : (
              <>
                <StatsCard title="Today's Appointments" value={stats.todaysAppointments} />
                <StatsCard title="Completed Today" value={stats.completedToday} />
                <StatsCard title="Total Patients" value={stats.totalPatients} />
              </>
            )}
          </div>
        )}

        {!consultationMode && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold text-slate-900">
                {formatLabel("Current Patient")}
              </h2>
              {currentPatient ? (
                <>
                  <p className="text-xl font-bold text-slate-900">
                    {formatName(currentPatient.patient?.name || "Unknown")}
                  </p>
                  <p className="text-sm text-gray-600">
                    Age {currentPatient.patient?.age || "N/A"} •{" "}
                    {currentPatient.patient?.bloodGroup || "N/A"}
                  </p>
              <p className="text-sm text-gray-600">
                {currentPatient.department
                  ? formatDepartment(currentPatient.department)
                  : "N/A"}
              </p>
              <p className="text-sm text-gray-600">{formatTime(currentPatient.date)}</p>
              <button
                onClick={() => handleOpenConsultation(currentPatient)}
                className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                    Open Consultation
                  </button>
                </>
              ) : (
                <p className="text-sm text-gray-500">No checked-in patient right now.</p>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">
                  {formatLabel("Today's Queue")}
                </h2>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300"
                  onClick={() => {
                    if (!refreshing) fetchAppointments();
                  }}
                  disabled={refreshing}
                >
                  {refreshing ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-slate-700" />
                  ) : (
                    "Refresh"
                  )}
                </button>
              </div>
              {todaysAppointmentsSorted.length === 0 ? (
                <p className="text-sm text-gray-500">No appointments today</p>
              ) : (
                <div>
                  {todaysAppointmentsSorted.map((appointment) => (
                    <div
                      key={appointment._id}
                      className="flex items-center justify-between border-b border-gray-100 py-2"
                    >
                      <div>
                        <p className="font-medium text-slate-900">
                          {formatName(appointment.patient?.name || "Unknown")}
                        </p>
                        <p className="text-xs text-gray-500">{formatTime(appointment.date)}</p>
                      </div>
                      <span
                        className={`rounded px-2 py-1 text-xs font-semibold ${getStatusStyle(
                          appointment.status
                        )}`}
                      >
                        {appointment.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {!consultationMode && (
          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">
                {formatLabel("Upcoming Appointments")}
              </h2>
              {upcomingAppointments.length === 0 ? (
                <p className="text-sm text-gray-500">No upcoming appointments</p>
              ) : (
                <div className="grid gap-3">
                  {upcomingAppointments.map((appointment) => (
                    <div
                      key={appointment._id}
                      className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm"
                    >
                      <p className="text-sm font-semibold text-slate-900">
                        {formatName(appointment.patient?.name || "Unknown")}
                      </p>
                      <p className="text-sm text-gray-600">
                        {appointment.department
                          ? formatDepartment(appointment.department)
                          : "N/A"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {appointment.date
                          ? new Date(appointment.date).toLocaleString()
                          : "Date not set"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">
                {formatLabel("Past Appointments")}
              </h2>
              {sortedPastAppointments.length === 0 ? (
                <p className="text-sm text-gray-500">No past appointments</p>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  {sortedPastAppointments.map((appointment) => (
                    <div key={appointment._id} className="border-b py-3 last:border-b-0">
                      <p className="font-medium text-slate-900">
                        {formatName(appointment.patient?.name || "Unknown")}
                      </p>
                      <p className="text-sm text-gray-500">
                        {appointment.date
                          ? new Date(appointment.date).toLocaleString()
                          : "Date not set"}
                      </p>
                      <button
                        type="button"
                        className="text-blue-600 text-sm hover:underline"
                        onClick={() =>
                          handleViewRecord(
                            appointment.patient?.healthId || appointment.patientHealthId
                          )
                        }
                      >
                        View Record
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">
                {formatLabel("Search Patient Records")}
              </h2>
              <input
                type="text"
                placeholder="Search patient by name or Health ID"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="mb-4 w-full rounded border border-slate-200 p-2 text-sm"
              />
              {searchResults.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {search.trim().length < 2
                    ? "Type at least 2 characters to search."
                    : "No patients found."}
                </p>
              ) : (
                <div className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                  {searchResults.map((patient) => (
                    <div
                      key={patient.healthId}
                      className="cursor-pointer px-3 py-2 text-sm hover:bg-gray-50"
                      onClick={() => handleViewRecord(patient.healthId)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") handleViewRecord(patient.healthId);
                      }}
                    >
                      {formatName(patient.name || "Unknown")} — {patient.healthId}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {showRecords && (
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">Medical Records</h2>
                  <button
                    type="button"
                    className="text-sm text-slate-500 hover:text-slate-700"
                    onClick={() => setShowRecords(false)}
                  >
                    Close
                  </button>
                </div>
                {records.length === 0 ? (
                  <p className="text-sm text-slate-500">No records found.</p>
                ) : (
                  <div className="grid gap-3">
                    {records.map((record) => (
                      <div key={record._id} className="border-b border-slate-100 py-3">
                        <p className="text-sm">
                          <span className="font-semibold">Diagnosis:</span>{" "}
                          {record.diagnosis || "N/A"}
                        </p>
                        <p className="text-sm">
                          <span className="font-semibold">Notes:</span>{" "}
                          {record.notes || "N/A"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {consultationMode && (
          <div className="grid gap-6 lg:grid-cols-3">
            {!selectedAppointment ? (
              <div className="col-span-3 mb-6 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">Select a checked-in patient to begin.</p>
              </div>
            ) : (
              <>
                <div className="col-span-1 mb-6 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                  <h2 className="mb-3 text-lg font-semibold text-slate-900">
                    {formatLabel("Patient Info")}
                  </h2>
                  <div className="grid gap-2 text-sm text-gray-700">
                    <p>
                      <span className="font-semibold">Name:</span>{" "}
                      {formatName(selectedAppointment.patient?.name || "Unknown")}
                    </p>
                    <p>
                      <span className="font-semibold">Age:</span>{" "}
                      {selectedAppointment.patient?.age || "N/A"}
                    </p>
                    <p>
                      <span className="font-semibold">Blood Group:</span>{" "}
                      {selectedAppointment.patient?.bloodGroup || "N/A"}
                    </p>
                    <p>
                      <span className="font-semibold">Health ID:</span>{" "}
                      {selectedAppointment.patient?.healthId || "N/A"}
                    </p>
                    <p>
                      <span className="font-semibold">Phone:</span>{" "}
                      {selectedAppointment.patient?.phone || "N/A"}
                    </p>
                  </div>
                </div>

                <div className="col-span-2 mb-6 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                  <h2 className="mb-3 text-lg font-semibold text-slate-900">
                    {formatLabel("Consultation")}
                  </h2>
                  <form onSubmit={handleAddRecord} className="grid gap-4">
                    <div>
                      <p className="text-xs font-semibold text-slate-600">
                        {formatLabel("Diagnosis")}
                      </p>
                      <input
                        className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        placeholder="Diagnosis"
                        value={diagnosis}
                        onChange={(event) => setDiagnosis(event.target.value)}
                        required
                      />
                    </div>

                    <div className="rounded-lg border border-slate-200 p-3">
                      <p className="text-xs font-semibold text-slate-600">
                        {formatLabel("Prescription")}
                      </p>
                      <div className="mt-3 grid gap-2">
                        <input
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          placeholder="Medicine"
                          name="medicine"
                          value={medicineForm.medicine}
                          onChange={handleMedicineChange}
                        />
                        <div className="grid gap-2 md:grid-cols-2">
                          <input
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            placeholder="Dose"
                            name="dose"
                            value={medicineForm.dose}
                            onChange={handleMedicineChange}
                          />
                          <input
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            placeholder="Frequency"
                            name="frequency"
                            value={medicineForm.frequency}
                            onChange={handleMedicineChange}
                          />
                        </div>
                        <input
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          placeholder="Duration"
                          name="duration"
                          value={medicineForm.duration}
                          onChange={handleMedicineChange}
                        />
                        <button
                          type="button"
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300"
                          onClick={handleAddMedicine}
                        >
                          Add Medicine
                        </button>
                      </div>
                      {medicines.length > 0 && (
                        <div className="mt-3">
                          {medicines.map((med, index) => (
                            <div
                              key={index}
                              className="mb-2 flex items-center justify-between rounded-lg bg-white p-3 shadow"
                            >
                              <div>
                                <p className="font-medium text-slate-900">
                                  {index + 1}. {formatMedicine(med.medicine || "")}
                                </p>
                                <p className="text-sm text-gray-600">
                                  {med.dose} · {med.frequency} · {med.duration}
                                </p>
                              </div>
                              <button
                                type="button"
                                className="text-sm text-red-500 hover:underline"
                                onClick={() => removeMedicine(index)}
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-slate-600">
                        {formatLabel("Notes")}
                      </p>
                      <textarea
                        className="mt-2 min-h-[90px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        placeholder="Notes"
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                      />
                    </div>

                    <button
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                      disabled={submittingRecord}
                    >
                      {submittingRecord ? (
                        <div className="mx-auto h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                      ) : (
                        "Save Medical Record"
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleCompleteConsultation}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                    >
                      Complete Consultation
                    </button>
                    <button
                      type="button"
                      onClick={handleExitConsultation}
                      className="rounded-lg bg-gray-500 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-600"
                    >
                      Exit Consultation
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DoctorDashboard;
