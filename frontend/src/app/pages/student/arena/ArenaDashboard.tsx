import { useEffect, useState } from "react";
import { AuroraText } from "@/components/magicui/aurora-text";
import { apiClient } from "@/lib/api-client";
import "./arena.css";
import ArenaBattle from "./ArenaBattle";

export default function ArenaDashboard() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [battling, setBattling] = useState(false);

  useEffect(() => {
    // Fetch courses enrolled by the student
    const fetchCourses = async () => {
      try {
        const response = await apiClient.get<any[]>('/arena/courses');
        setCourses(response.data);
      } catch (err) {
        console.error("Failed to load arena courses", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, []);

  if (battling && selectedCourse) {
    return <ArenaBattle courseId={selectedCourse} onExit={() => setBattling(false)} />;
  }

  return (
    <div className="arena-container">
      <div className="arena-header">
        <h1 className="text-4xl font-bold mb-2">
          <AuroraText>Knowledge Clash Arena</AuroraText>
        </h1>
        <p className="text-slate-400">Put your knowledge to the test and earn Mastery.</p>
      </div>

      <div className="arena-content">
        {loading ? (
          <div className="arena-loader">Loading Arena...</div>
        ) : (
          <div className="arena-course-selection">
            <h2 className="text-2xl font-semibold mb-4 text-white">Select a Course to Battle</h2>
            {courses.length === 0 ? (
              <p className="text-slate-400">You are not enrolled in any active courses.</p>
            ) : (
              <div className="arena-course-grid">
                {courses.map((course) => (
                  <div 
                    key={course.courseId} 
                    className={`arena-course-card ${selectedCourse === course.courseId ? 'selected' : ''}`}
                    onClick={() => setSelectedCourse(course.courseId)}
                  >
                    <div className="course-card-content">
                      <h3 className="text-xl font-bold text-white mb-2">{course.courseName}</h3>
                      <p className="text-sm text-slate-300">Status: {course.status}</p>
                    </div>
                    <div className="course-card-glow"></div>
                  </div>
                ))}
              </div>
            )}
            
            {selectedCourse && (
              <div className="arena-actions mt-8">
                <button onClick={() => setBattling(true)} className="arena-btn-primary">
                  <span>Enter Battle</span>
                </button>
                <button className="arena-btn-secondary ml-4">
                  Edit Deck
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
