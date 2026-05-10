<?php
$file = "C:/Users/MSI/Desktop/letspeak/frontend/src/pages/shared/CourseDetails.jsx";
$lines = file($file);
$replacement = <<<EOF
                let isCompleted = false;
                
                if (course?.is_dual) {
                    let anyPresentOrAbsent = false;
                    if (course.students && Array.isArray(course.students)) {
                        course.students.forEach(student => {
                            const studentIdStr = String(student.id);
                            let att = "pending";
                            if (lecture.student_attendance) {
                                const savedData = Array.isArray(lecture.student_attendance) 
                                    ? lecture.student_attendance.find((_, i) => course.students[i]?.id === student.id)
                                    : lecture.student_attendance[studentIdStr] || lecture.student_attendance[student.id];
                                if (savedData?.attendance) att = savedData.attendance;
                            }
                            if (rawEdited.student_attendance?.[studentIdStr]?.attendance) {
                                att = rawEdited.student_attendance[studentIdStr].attendance;
                            }
                            if (att === "present" || att === "absent") {
                                anyPresentOrAbsent = true;
                            }
                        });
                    }
                    isCompleted = anyPresentOrAbsent;
                    if (rawEdited.is_completed !== undefined && rawEdited.is_completed !== null) {
                        isCompleted = isCompleted || rawEdited.is_completed;
                    } else if (lecture.is_completed !== undefined && lecture.is_completed !== null) {
                        isCompleted = isCompleted || lecture.is_completed;
                    }
                } else {
                    isCompleted = currentAttendance === "present" || currentAttendance === "absent";
                    if (rawEdited.is_completed !== undefined && rawEdited.is_completed !== null) {
                        isCompleted = isCompleted || rawEdited.is_completed;
                    } else if (lecture.is_completed !== undefined && lecture.is_completed !== null) {
                        isCompleted = isCompleted || lecture.is_completed;
                    }
                }
EOF;
array_splice($lines, 2114, 43, explode("\n", $replacement . "\n"));
file_put_contents($file, implode("", $lines));
echo "Fixed";

