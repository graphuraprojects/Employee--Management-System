import React, { useState, useEffect } from "react";
import EmployeesSidebar from "../../../Components/EmployeesSidebar";
import LeaveSummaryGrid from "./LeaveSummaryGrid";
import LeaveCard from "./LeaveCard";
import RequestHistory from "./RequestHistory";
import { leaveService } from "../../../services/leaveServive";

const leaveOptions = [
  {
    value: "planned_leave",
    label: "Planned Leave (48 hours advance)",
    minHours: 48,
    requiresDocument: false,
  },
  {
    value: "unplanned_leave",
    label: "Unplanned Leave (2 hours advance)",
    minHours: 2,
    requiresDocument: false,
  },
  {
    value: "sick_leave",
    label: "Sick Leave (4 hours advance)",
    minHours: 4,
    requiresDocument: true,
  },
];

const EmployeeLeave = () => {
  const [leaveType, setLeaveType] = useState("planned_leave");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");
  const [uploadedFile, setUploadedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "" });
  const [leaveDetails, setLeaveDetails] = useState();
  const [leaveBalance, setLeaveBalance] = useState();

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "" }), 4000);
  };

  useEffect(() => {
    fetchEmployeeLeaves();
  }, []);

  const fetchEmployeeLeaves = async () => {
    try {
      const result = await leaveService.getAppliedLeave();
      console.log(result);
      if (result.success && result) {
        setLeaveDetails(result.data.employeeLeaves);
        setLeaveBalance(result.data.leaveBalance);
      }
    } catch (error) {
      console.error("error fetching requested leave : ", error);
    }
  };

  // Check for date overlap with existing leaves
  const checkForConflicts = () => {
    if (!fromDate || !toDate || !leaveDetails || leaveDetails.length === 0) {
      return null;
    }

    const newStart = new Date(fromDate);
    const newEnd = new Date(toDate);
    newStart.setHours(0, 0, 0, 0);
    newEnd.setHours(23, 59, 59, 999);

    // Check for pending or approved leaves that overlap
    for (const leave of leaveDetails) {
      if (leave.status === "pending" || leave.status === "approved") {
        const existingStart = new Date(leave.startDate);
        const existingEnd = new Date(leave.endDate);
        existingStart.setHours(0, 0, 0, 0);
        existingEnd.setHours(23, 59, 59, 999);

        // Check overlap
        if (newStart <= existingEnd && newEnd >= existingStart) {
          return {
            type: "conflict",
            message: `You already have a ${leave.status} leave from ${existingStart.toLocaleDateString()} to ${existingEnd.toLocaleDateString()}.`,
          };
        }
      }
    }

    return null;
  };

  // Validate advance notice requirement
  const validateAdvanceNotice = (leaveType, fromDate) => {
    const selectedLeave = leaveOptions.find((opt) => opt.value === leaveType);
    if (!selectedLeave) return { valid: true };

    const minHours = selectedLeave.minHours;
    const now = new Date();
    const leaveStart = new Date(fromDate);

    const hoursUntilLeave = (leaveStart - now) / (1000 * 60 * 60);

    if (hoursUntilLeave < minHours) {
      return {
        valid: false,
        message: `${selectedLeave.label.split("(")[0].trim()} requires ${minHours} hours advance notice. Leave starts in ${Math.round(hoursUntilLeave)} hours.`,
      };
    }

    return { valid: true };
  };

  // Handle file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        showToast("File size must be less than 10MB", "error");
        return;
      }
      // Check file type - Only PDF, JPG, PNG
      const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
      if (!allowedTypes.includes(file.type)) {
        showToast("Only PDF, JPG, and PNG files are allowed", "error");
        return;
      }
      setUploadedFile(file);
    }
  };

  // Calculate duration between two dates
  const calculateDuration = () => {
    if (!fromDate || !toDate) return 0;

    const from = new Date(fromDate);
    const to = new Date(toDate);

    if (to < from) return 0;

    const diffTime = Math.abs(to - from);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both days

    return diffDays;
  };

  // Alternative component to show when already on leave
  const OnLeaveAlert = () => {
    // Find the active approved leave
    const activeLeave = leaveDetails?.find((leave) => {
      if (leave.status !== "approved") return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return today >= start && today <= end;
    });

    if (!activeLeave) return null;

    return (
      <div className="mx-[15px] md:mx-[30px] mb-6 p-4 bg-orange-50 border border-orange-300 rounded-xl">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-orange-400 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-white font-bold text-sm">!</span>
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-orange-900 text-base">
              You are currently on leave
            </h3>
            <p className="text-orange-800 text-sm mt-1">
              Your {activeLeave.leaveType} leave is active from{" "}
              {new Date(activeLeave.startDate).toLocaleDateString()} to{" "}
              {new Date(activeLeave.endDate).toLocaleDateString()}
            </p>
            <p className="text-orange-700 text-xs mt-2 font-medium">
              You cannot apply for new leave while on active leave. Please wait
              until your current leave ends.
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!leaveType) {
      showToast("Please select a leave type", "error");
      return;
    }

    if (!fromDate) {
      showToast("Please select a start date", "error");
      return;
    }

    if (!toDate) {
      showToast("Please select an end date", "error");
      return;
    }

    if (new Date(toDate) < new Date(fromDate)) {
      showToast("End date cannot be before start date", "error");
      return;
    }

    if (!reason.trim()) {
      showToast("Please provide a reason for your leave", "error");
      return;
    }

    // Validate advance notice
    const advanceValidation = validateAdvanceNotice(leaveType, fromDate);
    if (!advanceValidation.valid) {
      showToast(advanceValidation.message, "error");
      return;
    }

    // Check for conflicts
    const conflict = checkForConflicts();
    if (conflict) {
      showToast(conflict.message, "error");
      return;
    }

    // Check if document is required for Sick Leave
    const selectedLeave = leaveOptions.find((opt) => opt.value === leaveType);
    if (selectedLeave?.requiresDocument && !uploadedFile) {
      showToast("Supporting document is mandatory for Sick Leave.", "error");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append(
        "leaveData",
        JSON.stringify({
          leaveType,
          fromDate,
          toDate,
          reason: reason.trim(),
        }),
      );

      if (uploadedFile) {
        formData.append("document", uploadedFile);
      }

      // Use appropriate API endpoint
      const response = await leaveService.applyLeave({
        leaveType,
        fromDate,
        toDate,
        reason: reason.trim(),
      });

      if (response.success) {
        showToast("Leave request submitted successfully!", "success");
        fetchEmployeeLeaves();
        // Reset form
        setLeaveType("planned_leave");
        setFromDate("");
        setToDate("");
        setReason("");
        setUploadedFile(null);
      }
    } catch (err) {
      console.error("Error submitting leave request:", err);
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        "Failed to submit leave request. Please try again.";
      showToast(errorMessage, "error");
    } finally {
      setLoading(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setLeaveType("planned_leave");
    setFromDate("");
    setToDate("");
    setReason("");
    setUploadedFile(null);
  };

  const duration = calculateDuration();

  return (
    <>
      {/* Toast Notification */}
      {toast.show && (
        <div
          className={`fixed top-6 right-6 z-50 animate-slideIn ${toast.type === "error" ? "bg-red-500" : "bg-green-500"} text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[280px] max-w-md`}
        >
          <div
            className={`w-2 h-2 rounded-full ${toast.type === "error" ? "bg-red-300" : "bg-green-300"}`}
          ></div>
          <span className="font-medium">{toast.message}</span>
          <button
            onClick={() => setToast({ show: false, message: "", type: "" })}
            className="ml-auto text-white/80 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      <div className="main md:flex">
        <div className="left lg:w-64 ">
          <EmployeesSidebar />
        </div>

        <div className="right-main lg:w-[100%] md:px-[40px] lg:px-[60px] px-4 lg:px-10 py-8 mt-8 md:mt-0 lg:mt-0">
          <div className="main-1 md:mt-[25px] lg:mt-[35px] mt-4">
            {/* Header Section - Enhanced */}
            <div className="relative mb-6 md:mb-8">
              {/* Decorative background */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-100 rounded-full blur-3xl -z-10 opacity-60"></div>
              <div className="absolute bottom-0 left-0 w-40 h-40 bg-cyan-100 rounded-full blur-3xl -z-10 opacity-60"></div>

              <div className="px-4 md:px-[30px]">
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                  <div>
                    <h1 className="text-2xl md:text-3xl lg:text-[32px] font-bold text-slate-800 bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
                      Leave Management
                    </h1>
                    <p className="text-sm md:text-base text-slate-600 mt-1 max-w-2xl">
                      Request time off, track your balance and view request
                      history.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-2 border border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100/80 text-sm text-blue-700 rounded-full px-4 py-2 shadow-sm hover:shadow-md transition-all duration-300 w-fit">
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                    Current Cycle: 2026-2027
                  </span>
                </div>
              </div>
            </div>

            {/* Leave Cards */}
            <LeaveSummaryGrid leaveBalanceDetails={leaveBalance} />

            {/* Alert Section */}
            <div className="px-4 md:px-[30px]">
              <OnLeaveAlert />
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="right-main-2 md:mx-[17px] mt-6 md:mt-8">
            <div className="flex flex-col md:flex-row gap-6">
              {/* New Request Form Card */}
              <div className="w-full md:w-1/2 bg-white rounded-2xl border border-blue-100 overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300">
                {/* Card Header with enhanced gradient */}
                <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-500 to-blue-400 px-4 sm:px-6 py-4 sm:py-5 text-white">
                  <div className="absolute -top-10 -right-10 w-20 h-20 bg-white/10 rounded-full blur-2xl"></div>
                  <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>

                  <div className="relative flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-semibold">
                        New Request
                      </h3>
                      <p className="text-xs sm:text-sm text-blue-100">
                        Submit a new leave application
                      </p>
                    </div>
                  </div>
                </div>

                {/* Form Body */}
                <form
                  onSubmit={handleSubmit}
                  className="p-4 sm:p-5 md:p-6 space-y-4 sm:space-y-5"
                >
                  {/* LEAVE TYPE */}
                  <div className="space-y-2">
                    <label
                      htmlFor="leaveType"
                      className="block text-sm font-semibold text-slate-700"
                    >
                      Leave Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="leaveType"
                      value={leaveType}
                      onChange={(e) => setLeaveType(e.target.value)}
                      className="w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white hover:border-blue-300"
                      disabled={loading}
                    >
                      {leaveOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>

                    {/* Info Box - Enhanced */}
                    <div className="mt-3 p-3 sm:p-4 rounded-xl bg-gradient-to-r from-blue-50 to-blue-100/50 border border-blue-200 hover:shadow-md transition-all">
                      <div className="flex items-start gap-2">
                        <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg
                            className="w-3 h-3 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-blue-900">
                            {
                              leaveOptions.find(
                                (opt) => opt.value === leaveType,
                              )?.label
                            }
                          </p>
                          <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                            {leaveType === "planned_leave" &&
                              "⏰ Must be applied at least 48 hours before leave start date."}
                            {leaveType === "unplanned_leave" &&
                              "⚡ Must be applied at least 2 hours before leave start date."}
                            {leaveType === "sick_leave" &&
                              "🏥 Must be applied within 4 hours before leave start date. Supporting document is mandatory."}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* DATES - Enhanced */}
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">
                        From <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="date"
                          value={fromDate}
                          onChange={(e) => setFromDate(e.target.value)}
                          className="w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all hover:border-blue-300"
                          disabled={loading}
                          min={new Date().toISOString().split("T")[0]}
                        />
                        
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">
                        To <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="date"
                          value={toDate}
                          onChange={(e) => setToDate(e.target.value)}
                          className="w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all hover:border-blue-300"
                          disabled={loading}
                          min={
                            fromDate || new Date().toISOString().split("T")[0]
                          }
                        />
                        
                      </div>
                    </div>
                  </div>

                  {/* DURATION - Enhanced */}
                  <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 rounded-xl px-4 py-3 border border-slate-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">
                        Total Duration:
                      </span>
                      <span className="text-lg font-bold text-blue-600">
                        {duration} {duration === 1 ? "Day" : "Days"}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min((duration / 30) * 100, 100)}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* REASON - Enhanced */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      Reason <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Please describe the reason for your leave..."
                      className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all hover:border-blue-300 placeholder:text-slate-400"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      disabled={loading}
                    />
                  </div>

                  {/* SUPPORTING DOCUMENT - Enhanced */}
                  <div className="border-2 border-slate-200 rounded-xl p-4 bg-gradient-to-br from-slate-50 to-white hover:border-blue-300 transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">
                          Supporting Document
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          PDF, JPG, PNG (Max 10MB)
                        </p>
                      </div>
                      <span
                        className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
                          leaveType === "sick_leave"
                            ? "bg-red-100 text-red-700 border border-red-200"
                            : "bg-blue-100 text-blue-700 border border-blue-200"
                        }`}
                      >
                        {leaveType === "sick_leave" ? "Required" : "Optional"}
                      </span>
                    </div>

                    <div
                      className="relative group flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-white p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all"
                      onClick={() =>
                        document.getElementById("emp-upload-input")?.click()
                      }
                      onDrop={(e) => {
                        e.preventDefault();
                        const f = e.dataTransfer.files[0];
                        if (f) handleFileUpload({ target: { files: [f] } });
                      }}
                      onDragOver={(e) => e.preventDefault()}
                    >
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <svg
                          className="w-7 h-7 text-blue-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700">
                          Click to upload or drag and drop
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          PDF, JPG, PNG (Max 10MB)
                        </p>
                      </div>
                      <input
                        id="emp-upload-input"
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </div>

                    {uploadedFile && (
                      <div className="mt-4 bg-white p-3 rounded-xl border border-slate-200 animate-slideIn">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                              {uploadedFile.type.startsWith("image/") ? (
                                <img
                                  src={URL.createObjectURL(uploadedFile)}
                                  alt="preview"
                                  className="w-full h-full object-cover rounded-lg"
                                />
                              ) : (
                                uploadedFile.name.split(".").pop().toUpperCase()
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900 truncate max-w-[150px] sm:max-w-[200px]">
                                {uploadedFile.name}
                              </p>
                              <p className="text-xs text-slate-500">
                                {(uploadedFile.size / 1024 / 1024).toFixed(2)}{" "}
                                MB
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setUploadedFile(null)}
                            className="px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-red-500 transition-all"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* BUTTONS - Enhanced */}
                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="flex-1 border-2 border-slate-300 text-slate-700 py-3 rounded-xl font-semibold hover:bg-slate-50 hover:border-slate-400 transition-all active:scale-95 disabled:opacity-50"
                      disabled={loading}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-600 transition-all hover:shadow-lg hover:shadow-blue-500/25 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={loading}
                    >
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg
                            className="animate-spin h-5 w-5 text-white"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          <span>Submitting...</span>
                        </span>
                      ) : (
                        "Submit Request"
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Request History */}
              <div className="w-full md:w-1/2">
                <RequestHistory requestedLeaves={leaveDetails} />
              </div>
            </div>
          </div>
        </div>
        <style jsx>{`
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .animate-slideIn {
            animation: slideIn 0.3s ease-out;
          }
        `}</style>
      </div>
      
    </>
  );
};

export default EmployeeLeave;
