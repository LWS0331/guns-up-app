'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Operator, Workout, WorkoutBlock, ExerciseBlock, ConditioningBlock, DayTag, ViewMode } from '@/lib/types';
import { EXERCISE_LIBRARY } from '@/data/exercises';

interface PlannerProps {
  operator: Operator;
  onUpdateOperator: (updated: Operator) => void;
}

const Planner: React.FC<PlannerProps> = ({ operator, onUpdateOperator }) => {
  // ============================================================================
  // STATE
  // ============================================================================
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<Workout | null>(null);
  const [showDayTagEditor, setShowDayTagEditor] = useState<string | null>(null);
  const [tagNoteInput, setTagNoteInput] = useState('');
  const [selectedTagColor, setSelectedTagColor] = useState<'green' | 'amber' | 'red' | 'cyan'>('green');
  const [showDayMenu, setShowDayMenu] = useState<string | null>(null);
  const [showWorkoutBuilder, setShowWorkoutBuilder] = useState(false);

  // Workout builder state
  const [builderData, setBuilderData] = useState<Workout>({
    id: '',
    date: '',
    title: '',
    notes: '',
    warmup: '',
    blocks: [],
    cooldown: '',
    completed: false,
  });

  const [exerciseSearchQuery, setExerciseSearchQuery] = useState('');
  const [showExerciseAutocomplete, setShowExerciseAutocomplete] = useState(false);
  const [autocompleteFor, setAutocompleteFor] = useState<number | null>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const generateId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const parseDate = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const formatDateForDisplay = (dateStr: string): string => {
    const date = parseDate(dateStr);
    const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  const getWeekDates = (date: Date): Date[] => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));

    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      week.push(date);
    }
    return week;
  };

  const getMonthDates = (date: Date): Date[][] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const dayOfWeek = firstDay.getDay();
    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

    const grid: Date[][] = [];
    const current = new Date(startDate);

    for (let week = 0; week < 6; week++) {
      const weekDates: Date[] = [];
      for (let day = 0; day < 7; day++) {
        weekDates.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      grid.push(weekDates);
    }

    return grid;
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  };

  const isCurrentMonth = (date: Date): boolean => {
    return date.getMonth() === currentDate.getMonth() && date.getFullYear() === currentDate.getFullYear();
  };

  const getWorkoutForDate = (date: Date | string): Workout | undefined => {
    const dateKey = typeof date === 'string' ? date : formatDate(date);
    return operator.workouts[dateKey];
  };

  const getDayTag = (dateStr: string): DayTag | undefined => {
    return operator.dayTags?.[dateStr];
  };

  const fuzzyMatch = (query: string, text: string): boolean => {
    const q = query.toLowerCase();
    const t = text.toLowerCase();
    let qIdx = 0;
    for (let i = 0; i < t.length && qIdx < q.length; i++) {
      if (t[i] === q[qIdx]) qIdx++;
    }
    return qIdx === q.length;
  };

  const getFilteredExercises = (query: string) => {
    if (!query.trim()) return [];
    return EXERCISE_LIBRARY.filter(ex => fuzzyMatch(query, ex.name)).slice(0, 8);
  };

  const getBlockLabels = (blocks: WorkoutBlock[]): string[] => {
    const labels: string[] = [];
    let currentLetter = 'A';
    let supersetCount = 0;

    for (let i = 0; i < blocks.length; i++) {
      const isLinkedToPrevious = i > 0 && blocks[i - 1].isLinkedToNext;

      if (!isLinkedToPrevious) {
        labels.push(currentLetter);
        supersetCount = 0;
        currentLetter = String.fromCharCode(currentLetter.charCodeAt(0) + 1);
      } else {
        supersetCount++;
        labels.push(`${labels[i - 1].charAt(0)}${supersetCount + 1}`);
      }
    }

    return labels;
  };

  const findLastExerciseLog = (exerciseName: string): { date: string; prescription: string } | null => {
    const entries = Object.entries(operator.workouts).sort(([dateA], [dateB]) => dateB.localeCompare(dateA));

    for (const [date, workout] of entries) {
      if (date >= (selectedDate || formatDate(new Date()))) continue;

      for (const block of workout.blocks) {
        if (block.type === 'exercise' && block.exerciseName.toLowerCase() === exerciseName.toLowerCase()) {
          return { date, prescription: block.prescription };
        }
      }
    }

    return null;
  };

  const getTagColor = (color: string): string => {
    switch (color) {
      case 'green':
        return '#00ff41';
      case 'amber':
        return '#ffb800';
      case 'red':
        return '#ff4444';
      case 'cyan':
        return '#00bcd4';
      default:
        return '#00ff41';
    }
  };

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    setSelectedDate(null);
    setShowWorkoutBuilder(false);
  };

  const handleNavigatePrevious = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setDate(newDate.getDate() - 1);
    }
    setCurrentDate(newDate);
  };

  const handleNavigateNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setCurrentDate(newDate);
  };

  const handleAddWorkout = (dateStr: string) => {
    setSelectedDate(dateStr);
    setBuilderData({
      id: generateId(),
      date: dateStr,
      title: '',
      notes: '',
      warmup: '',
      blocks: [],
      cooldown: '',
      completed: false,
    });
    setShowWorkoutBuilder(true);
    setShowDayMenu(null);
  };

  const handleEditWorkout = (workout: Workout) => {
    setSelectedDate(workout.date);
    setBuilderData(JSON.parse(JSON.stringify(workout)));
    setShowWorkoutBuilder(true);
    setShowDayMenu(null);
  };

  const handleSaveWorkout = () => {
    if (!selectedDate || !builderData.title.trim()) {
      alert('Please enter a workout title');
      return;
    }

    const updated = { ...operator };
    updated.workouts[selectedDate] = builderData;
    onUpdateOperator(updated);
    setShowWorkoutBuilder(false);
    setSelectedDate(null);
  };

  const handleCancelWorkout = () => {
    setShowWorkoutBuilder(false);
    setSelectedDate(null);
  };

  const handleAddExerciseBlock = () => {
    const newBlock: ExerciseBlock = {
      type: 'exercise',
      id: generateId(),
      sortOrder: builderData.blocks.length,
      exerciseName: '',
      prescription: '',
      isLinkedToNext: false,
    };
    setBuilderData({
      ...builderData,
      blocks: [...builderData.blocks, newBlock],
    });
  };

  const handleAddConditioningBlock = () => {
    const newBlock: ConditioningBlock = {
      type: 'conditioning',
      id: generateId(),
      sortOrder: builderData.blocks.length,
      format: '',
      description: '',
      isLinkedToNext: false,
    };
    setBuilderData({
      ...builderData,
      blocks: [...builderData.blocks, newBlock],
    });
  };

  const handleUpdateBlock = (index: number, updates: Record<string, unknown>) => {
    const newBlocks = [...builderData.blocks];
    newBlocks[index] = { ...newBlocks[index], ...updates } as WorkoutBlock;
    setBuilderData({
      ...builderData,
      blocks: newBlocks,
    });
  };

  const handleDeleteBlock = (index: number) => {
    const newBlocks = builderData.blocks.filter((_, i) => i !== index);
    setBuilderData({
      ...builderData,
      blocks: newBlocks,
    });
  };

  const handleCopyWorkout = (workout: Workout) => {
    setClipboard(workout);
    setShowDayMenu(null);
  };

  const handlePasteWorkout = (dateStr: string) => {
    if (!clipboard) return;

    const newWorkout: Workout = {
      ...JSON.parse(JSON.stringify(clipboard)),
      id: generateId(),
      date: dateStr,
      completed: false,
    };

    const updated = { ...operator };
    updated.workouts[dateStr] = newWorkout;
    onUpdateOperator(updated);
    setShowDayMenu(null);
  };

  const handleSetRestDay = (dateStr: string) => {
    const updated = { ...operator };
    if (updated.workouts[dateStr]) {
      delete updated.workouts[dateStr];
    }
    updated.dayTags = updated.dayTags || {};
    updated.dayTags[dateStr] = { color: 'cyan', note: 'Rest Day' };
    onUpdateOperator(updated);
    setShowDayMenu(null);
  };

  const handleDeleteWorkout = (dateStr: string) => {
    if (!confirm('Delete this workout?')) return;

    const updated = { ...operator };
    if (updated.workouts[dateStr]) {
      delete updated.workouts[dateStr];
    }
    onUpdateOperator(updated);
    setShowWorkoutBuilder(false);
    setSelectedDate(null);
  };

  const handleSaveDayTag = (dateStr: string) => {
    const updated = { ...operator };
    updated.dayTags = updated.dayTags || {};
    updated.dayTags[dateStr] = {
      color: selectedTagColor,
      note: tagNoteInput,
    };
    onUpdateOperator(updated);
    setShowDayTagEditor(null);
    setTagNoteInput('');
  };

  const handleExerciseSelect = (exerciseName: string, blockIndex: number) => {
    handleUpdateBlock(blockIndex, { exerciseName });
    setShowExerciseAutocomplete(false);
    setExerciseSearchQuery('');
    setAutocompleteFor(null);
  };

  const handleExportJson = () => {
    const dataStr = JSON.stringify(operator, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${operator.callsign}_workouts_${formatDate(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ============================================================================
  // RENDER MONTH VIEW
  // ============================================================================

  const renderMonthView = () => {
    const monthDates = getMonthDates(currentDate);
    const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    return (
      <div>
        <div style={{ marginBottom: '20px', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'Orbitron', color: '#00ff41', margin: '0 0 20px 0', fontSize: '24px' }}>
            {monthName}
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', marginBottom: '20px' }}>
          {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(day => (
            <div
              key={day}
              style={{
                textAlign: 'center',
                fontFamily: 'Chakra Petch',
                color: '#00ff41',
                fontSize: '12px',
                fontWeight: 'bold',
                padding: '8px',
              }}
            >
              {day}
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
          {monthDates.map(week =>
            week.map(date => {
              const dateStr = formatDate(date);
              const workout = getWorkoutForDate(dateStr);
              const tag = getDayTag(dateStr);
              const isCurrentDay = isToday(date);
              const isInMonth = isCurrentMonth(date);
              const bgColor = isCurrentDay ? 'rgba(0, 255, 65, 0.1)' : isInMonth ? '#030303' : '#0a0a0a';

              return (
                <div
                  key={dateStr}
                  onClick={() => {
                    setSelectedDate(dateStr);
                    setViewMode('day');
                  }}
                  onContextMenu={e => {
                    e.preventDefault();
                    setShowDayMenu(dateStr);
                  }}
                  style={{
                    minHeight: '100px',
                    padding: '12px',
                    backgroundColor: bgColor,
                    border: isCurrentDay ? '2px solid #00ff41' : '1px solid rgba(0, 255, 65, 0.2)',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0, 255, 65, 0.05)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = bgColor;
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'Chakra Petch',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      color: isInMonth ? '#00ff41' : '#666',
                      marginBottom: '6px',
                    }}
                  >
                    {date.getDate()}
                  </div>

                  {workout && (
                    <div
                      style={{
                        fontFamily: 'Share Tech Mono',
                        fontSize: '10px',
                        color: '#00bcd4',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        marginBottom: '4px',
                      }}
                    >
                      {workout.title}
                    </div>
                  )}

                  {tag && (
                    <div
                      style={{
                        display: 'inline-block',
                        padding: '2px 6px',
                        backgroundColor: `${getTagColor(tag.color)}22`,
                        border: `1px solid ${getTagColor(tag.color)}`,
                        borderRadius: '3px',
                        fontFamily: 'Share Tech Mono',
                        fontSize: '9px',
                        color: getTagColor(tag.color),
                      }}
                    >
                      {tag.note.substring(0, 8)}
                    </div>
                  )}

                  {showDayMenu === dateStr && (
                    <DayMenu dateStr={dateStr} workout={workout} onClose={() => setShowDayMenu(null)} />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  // ============================================================================
  // RENDER WEEK VIEW
  // ============================================================================

  const renderWeekView = () => {
    const weekDates = getWeekDates(currentDate);
    const weekStart = formatDateForDisplay(formatDate(weekDates[0]));
    const weekEnd = formatDateForDisplay(formatDate(weekDates[6]));

    return (
      <div>
        <div style={{ marginBottom: '20px', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'Orbitron', color: '#00ff41', margin: '0 0 20px 0', fontSize: '24px' }}>
            Week: {weekStart} - {weekEnd}
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
          {weekDates.map(date => {
            const dateStr = formatDate(date);
            const workout = getWorkoutForDate(dateStr);
            const tag = getDayTag(dateStr);
            const isCurrentDay = isToday(date);
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });

            return (
              <div
                key={dateStr}
                onClick={() => {
                  setSelectedDate(dateStr);
                  setViewMode('day');
                }}
                style={{
                  minHeight: '200px',
                  padding: '12px',
                  backgroundColor: isCurrentDay ? 'rgba(0, 255, 65, 0.1)' : '#030303',
                  border: isCurrentDay ? '2px solid #00ff41' : '1px solid rgba(0, 255, 65, 0.2)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontFamily: 'Chakra Petch', color: '#00ff41', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>
                  {dayName} {date.getDate()}
                </div>

                {workout ? (
                  <div>
                    <div style={{ fontFamily: 'Chakra Petch', color: '#00bcd4', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>
                      {workout.title}
                    </div>
                    <div style={{ fontFamily: 'Share Tech Mono', fontSize: '10px', color: '#888' }}>
                      {workout.blocks.length} blocks
                    </div>
                  </div>
                ) : tag ? (
                  <div style={{ fontFamily: 'Chakra Petch', color: getTagColor(tag.color), fontSize: '12px' }}>
                    {tag.note}
                  </div>
                ) : (
                  <div style={{ fontFamily: 'Share Tech Mono', color: '#666', fontSize: '10px' }}>No workout</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ============================================================================
  // RENDER DAY VIEW
  // ============================================================================

  const renderDayView = () => {
    const dateObj = selectedDate ? parseDate(selectedDate) : currentDate;
    const dateStr = formatDate(dateObj);
    const workout = getWorkoutForDate(dateStr);
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    return (
      <div>
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontFamily: 'Orbitron', color: '#00ff41', margin: '0 0 10px 0', fontSize: '24px' }}>
            {dayName}
          </h2>
        </div>

        {showWorkoutBuilder ? (
          <WorkoutBuilder />
        ) : workout ? (
          <div style={{ padding: '20px', backgroundColor: '#0a0a0a', border: '1px solid rgba(0, 188, 212, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontFamily: 'Chakra Petch', color: '#00bcd4', margin: 0 }}>{workout.title}</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleEditWorkout(workout)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#00ff41',
                    color: '#000',
                    border: 'none',
                    fontFamily: 'Chakra Petch',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 'bold',
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteWorkout(dateStr)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#ff4444',
                    color: '#000',
                    border: 'none',
                    fontFamily: 'Chakra Petch',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 'bold',
                  }}
                >
                  Delete
                </button>
              </div>
            </div>

            {workout.notes && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontFamily: 'Chakra Petch', color: '#00ff41', fontSize: '12px', fontWeight: 'bold' }}>
                  COACH'S NOTES
                </div>
                <div style={{ fontFamily: 'Share Tech Mono', color: '#ccc', fontSize: '12px', marginTop: '4px' }}>
                  {workout.notes}
                </div>
              </div>
            )}

            {workout.warmup && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontFamily: 'Chakra Petch', color: '#ffb800', fontSize: '12px', fontWeight: 'bold' }}>
                  WARMUP
                </div>
                <div style={{ fontFamily: 'Share Tech Mono', color: '#ccc', fontSize: '12px', marginTop: '4px' }}>
                  {workout.warmup}
                </div>
              </div>
            )}

            {workout.blocks.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontFamily: 'Chakra Petch', color: '#00ff41', fontSize: '12px', fontWeight: 'bold', marginBottom: '12px' }}>
                  WORKOUT BLOCKS
                </div>
                {workout.blocks.map((block, idx) => {
                  const label = getBlockLabels(workout.blocks)[idx];
                  if (block.type === 'exercise') {
                    return (
                      <div key={block.id} style={{ marginBottom: '12px', paddingLeft: '12px', borderLeft: '2px solid #00bcd4' }}>
                        <div style={{ fontFamily: 'Chakra Petch', color: '#00bcd4', fontSize: '14px', fontWeight: 'bold' }}>
                          {label}) {block.exerciseName}
                        </div>
                        <div style={{ fontFamily: 'Share Tech Mono', color: '#888', fontSize: '11px', marginTop: '2px' }}>
                          {block.prescription}
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div key={block.id} style={{ marginBottom: '12px', paddingLeft: '12px', borderLeft: '2px solid #ffb800' }}>
                        <div style={{ fontFamily: 'Chakra Petch', color: '#ffb800', fontSize: '14px', fontWeight: 'bold' }}>
                          {block.format}
                        </div>
                        <div
                          style={{
                            fontFamily: 'Share Tech Mono',
                            color: '#888',
                            fontSize: '11px',
                            marginTop: '2px',
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {block.description}
                        </div>
                      </div>
                    );
                  }
                })}
              </div>
            )}

            {workout.cooldown && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontFamily: 'Chakra Petch', color: '#ffb800', fontSize: '12px', fontWeight: 'bold' }}>
                  COOLDOWN
                </div>
                <div style={{ fontFamily: 'Share Tech Mono', color: '#ccc', fontSize: '12px', marginTop: '4px' }}>
                  {workout.cooldown}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            <p style={{ fontFamily: 'Chakra Petch' }}>No workout for this day</p>
            <button
              onClick={() => handleAddWorkout(dateStr)}
              style={{
                marginTop: '12px',
                padding: '8px 16px',
                backgroundColor: '#00ff41',
                color: '#000',
                border: 'none',
                fontFamily: 'Chakra Petch',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              Create Workout
            </button>
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // WORKOUT BUILDER COMPONENT
  // ============================================================================

  const WorkoutBuilder = () => {
    const blockLabels = getBlockLabels(builderData.blocks);

    return (
      <div
        style={{
          padding: '24px',
          backgroundColor: '#030303',
          border: '1px solid rgba(0, 188, 212, 0.4)',
          borderRadius: '4px',
          maxWidth: '900px',
        }}
      >
        <h3 style={{ fontFamily: 'Chakra Petch', color: '#00ff41', margin: '0 0 20px 0', fontSize: '18px' }}>
          Workout Builder - {selectedDate}
        </h3>

        {/* TITLE */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontFamily: 'Chakra Petch', color: '#00ff41', fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
            Workout Title
          </label>
          <input
            type="text"
            value={builderData.title}
            onChange={e => setBuilderData({ ...builderData, title: e.target.value })}
            placeholder="e.g. Lower Body Push"
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: '#0a0a0a',
              border: '1px solid rgba(0, 255, 65, 0.3)',
              color: '#00ff41',
              fontFamily: 'Chakra Petch',
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* COACH'S NOTES */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontFamily: 'Chakra Petch', color: '#00ff41', fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
            Coach's Notes
          </label>
          <textarea
            value={builderData.notes}
            onChange={e => setBuilderData({ ...builderData, notes: e.target.value })}
            placeholder="Add coaching notes or cues..."
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: '#0a0a0a',
              border: '1px solid rgba(0, 255, 65, 0.3)',
              color: '#00ff41',
              fontFamily: 'Chakra Petch',
              fontSize: '12px',
              minHeight: '60px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* WARMUP */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontFamily: 'Chakra Petch', color: '#ffb800', fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
            Warmup
          </label>
          <textarea
            value={builderData.warmup}
            onChange={e => setBuilderData({ ...builderData, warmup: e.target.value })}
            placeholder="e.g. 10 min elliptical"
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: '#0a0a0a',
              border: '1px solid rgba(255, 184, 0, 0.3)',
              color: '#ffb800',
              fontFamily: 'Chakra Petch',
              fontSize: '12px',
              minHeight: '50px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* WORKOUT BLOCKS */}
        {builderData.blocks.length > 0 && (
          <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#0a0a0a', border: '1px solid rgba(0, 188, 212, 0.2)', borderRadius: '4px' }}>
            <h4 style={{ fontFamily: 'Chakra Petch', color: '#00bcd4', margin: '0 0 16px 0', fontSize: '14px' }}>
              WORKOUT BLOCKS
            </h4>

            {builderData.blocks.map((block, idx) => {
              const label = blockLabels[idx];
              const lastLog = block.type === 'exercise' ? findLastExerciseLog(block.exerciseName) : null;

              return (
                <div key={block.id} style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#000', border: '1px solid rgba(0, 255, 65, 0.2)', borderRadius: '3px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontFamily: 'Chakra Petch', color: '#00ff41', fontSize: '12px', fontWeight: 'bold' }}>
                      {label}
                    </span>
                    <button
                      onClick={() => handleDeleteBlock(idx)}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#ff4444',
                        color: '#fff',
                        border: 'none',
                        fontFamily: 'Share Tech Mono',
                        fontSize: '10px',
                        cursor: 'pointer',
                      }}
                    >
                      Delete
                    </button>
                  </div>

                  {block.type === 'exercise' ? (
                    <>
                      {/* Exercise Name */}
                      <div style={{ marginBottom: '12px', position: 'relative' }}>
                        <label style={{ fontFamily: 'Share Tech Mono', color: '#00bcd4', fontSize: '10px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                          Exercise Name
                        </label>
                        <input
                          type="text"
                          value={block.exerciseName}
                          onChange={e => {
                            handleUpdateBlock(idx, { exerciseName: e.target.value });
                            setAutocompleteFor(e.target.value.length > 0 ? idx : null);
                            setExerciseSearchQuery(e.target.value);
                            setShowExerciseAutocomplete(e.target.value.length > 0);
                          }}
                          placeholder="Search exercise..."
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            backgroundColor: '#0a0a0a',
                            border: '1px solid rgba(0, 188, 212, 0.4)',
                            color: '#00bcd4',
                            fontFamily: 'Share Tech Mono',
                            fontSize: '12px',
                            boxSizing: 'border-box',
                          }}
                        />

                        {showExerciseAutocomplete && autocompleteFor === idx && (
                          <div
                            ref={autocompleteRef}
                            style={{
                              position: 'absolute',
                              top: '100%',
                              left: 0,
                              right: 0,
                              backgroundColor: '#0a0a0a',
                              border: '1px solid #00bcd4',
                              zIndex: 100,
                              maxHeight: '150px',
                              overflowY: 'auto',
                            }}
                          >
                            {getFilteredExercises(block.exerciseName).map(ex => (
                              <div
                                key={ex.id}
                                onClick={() => handleExerciseSelect(ex.name, idx)}
                                style={{
                                  padding: '8px',
                                  cursor: 'pointer',
                                  borderBottom: '1px solid rgba(0, 188, 212, 0.2)',
                                  fontFamily: 'Share Tech Mono',
                                  fontSize: '11px',
                                  color: '#00bcd4',
                                }}
                                onMouseEnter={e => {
                                  (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0, 188, 212, 0.1)';
                                }}
                                onMouseLeave={e => {
                                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                                }}
                              >
                                {ex.name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Last Log */}
                      {lastLog && (
                        <div style={{ marginBottom: '12px', padding: '8px', backgroundColor: 'rgba(0, 255, 65, 0.05)', border: '1px solid rgba(0, 255, 65, 0.2)', borderRadius: '2px' }}>
                          <div style={{ fontFamily: 'Share Tech Mono', color: '#888', fontSize: '10px' }}>
                            Last logged: {lastLog.date} - {lastLog.prescription}
                          </div>
                        </div>
                      )}

                      {/* Prescription */}
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontFamily: 'Share Tech Mono', color: '#00bcd4', fontSize: '10px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                          Prescription
                        </label>
                        <textarea
                          value={block.prescription}
                          onChange={e => handleUpdateBlock(idx, { prescription: e.target.value })}
                          placeholder="e.g. 3 REPS EVERY 90 SECONDS X 4"
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            backgroundColor: '#0a0a0a',
                            border: '1px solid rgba(0, 188, 212, 0.4)',
                            color: '#00bcd4',
                            fontFamily: 'Share Tech Mono',
                            fontSize: '11px',
                            minHeight: '40px',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>

                      {/* Superset Link */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={block.isLinkedToNext}
                          onChange={e => handleUpdateBlock(idx, { isLinkedToNext: e.target.checked })}
                          style={{ cursor: 'pointer' }}
                        />
                        <label style={{ fontFamily: 'Share Tech Mono', color: '#00bcd4', fontSize: '10px', cursor: 'pointer' }}>
                          Superset to next exercise
                        </label>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Conditioning Format */}
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontFamily: 'Share Tech Mono', color: '#ffb800', fontSize: '10px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                          Format
                        </label>
                        <input
                          type="text"
                          value={block.format}
                          onChange={e => handleUpdateBlock(idx, { format: e.target.value })}
                          placeholder="e.g. 3 rounds for time"
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            backgroundColor: '#0a0a0a',
                            border: '1px solid rgba(255, 184, 0, 0.4)',
                            color: '#ffb800',
                            fontFamily: 'Share Tech Mono',
                            fontSize: '11px',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>

                      {/* Conditioning Description */}
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontFamily: 'Share Tech Mono', color: '#ffb800', fontSize: '10px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                          Description
                        </label>
                        <textarea
                          value={block.description}
                          onChange={e => handleUpdateBlock(idx, { description: e.target.value })}
                          placeholder="e.g. Run 400m&#10;10 box jumps&#10;15 Hang Power Clean"
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            backgroundColor: '#0a0a0a',
                            border: '1px solid rgba(255, 184, 0, 0.4)',
                            color: '#ffb800',
                            fontFamily: 'Share Tech Mono',
                            fontSize: '11px',
                            minHeight: '60px',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ADD BLOCKS */}
        <div style={{ marginBottom: '20px', display: 'flex', gap: '8px' }}>
          <button
            onClick={handleAddExerciseBlock}
            style={{
              padding: '8px 12px',
              backgroundColor: '#00bcd4',
              color: '#000',
              border: 'none',
              fontFamily: 'Chakra Petch',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            + Exercise
          </button>
          <button
            onClick={handleAddConditioningBlock}
            style={{
              padding: '8px 12px',
              backgroundColor: '#ffb800',
              color: '#000',
              border: 'none',
              fontFamily: 'Chakra Petch',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            + Conditioning
          </button>
        </div>

        {/* COOLDOWN */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontFamily: 'Chakra Petch', color: '#ffb800', fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
            Cooldown
          </label>
          <textarea
            value={builderData.cooldown}
            onChange={e => setBuilderData({ ...builderData, cooldown: e.target.value })}
            placeholder="e.g. 5 min walk + stretch"
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: '#0a0a0a',
              border: '1px solid rgba(255, 184, 0, 0.3)',
              color: '#ffb800',
              fontFamily: 'Chakra Petch',
              fontSize: '12px',
              minHeight: '50px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* ACTION BUTTONS */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={handleCancelWorkout}
            style={{
              padding: '10px 16px',
              backgroundColor: 'transparent',
              border: '1px solid rgba(255, 68, 68, 0.5)',
              color: '#ff4444',
              fontFamily: 'Chakra Petch',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSaveWorkout}
            style={{
              padding: '10px 16px',
              backgroundColor: '#00ff41',
              color: '#000',
              border: 'none',
              fontFamily: 'Chakra Petch',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            Save Workout
          </button>
        </div>
      </div>
    );
  };

  // ============================================================================
  // DAY MENU COMPONENT
  // ============================================================================

  const DayMenu = ({ dateStr, workout, onClose }: { dateStr: string; workout?: Workout; onClose: () => void }) => {
    return (
      <div
        style={{
          position: 'absolute',
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#0a0a0a',
          border: '1px solid #00ff41',
          zIndex: 1000,
          minWidth: '150px',
          boxShadow: '0 0 20px rgba(0, 255, 65, 0.1)',
        }}
      >
        {!workout ? (
          <>
            <button
              onClick={() => handleAddWorkout(dateStr)}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 12px',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#00ff41',
                fontFamily: 'Chakra Petch',
                fontSize: '12px',
                cursor: 'pointer',
                textAlign: 'left',
                borderBottom: '1px solid rgba(0, 255, 65, 0.2)',
              }}
            >
              Workout
            </button>
            <button
              onClick={() => handleSetRestDay(dateStr)}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 12px',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#00bcd4',
                fontFamily: 'Chakra Petch',
                fontSize: '12px',
                cursor: 'pointer',
                textAlign: 'left',
                borderBottom: '1px solid rgba(0, 188, 212, 0.2)',
              }}
            >
              Rest Day
            </button>
            <button
              onClick={() => clipboard && handlePasteWorkout(dateStr)}
              disabled={!clipboard}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 12px',
                backgroundColor: 'transparent',
                border: 'none',
                color: clipboard ? '#ffb800' : '#666',
                fontFamily: 'Chakra Petch',
                fontSize: '12px',
                cursor: clipboard ? 'pointer' : 'not-allowed',
                textAlign: 'left',
              }}
            >
              Paste
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => handleEditWorkout(workout)}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 12px',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#00ff41',
                fontFamily: 'Chakra Petch',
                fontSize: '12px',
                cursor: 'pointer',
                textAlign: 'left',
                borderBottom: '1px solid rgba(0, 255, 65, 0.2)',
              }}
            >
              Edit
            </button>
            <button
              onClick={() => handleCopyWorkout(workout)}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 12px',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#ffb800',
                fontFamily: 'Chakra Petch',
                fontSize: '12px',
                cursor: 'pointer',
                textAlign: 'left',
                borderBottom: '1px solid rgba(255, 184, 0, 0.2)',
              }}
            >
              Copy
            </button>
            <button
              onClick={() => handleDeleteWorkout(dateStr)}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 12px',
                backgroundColor: 'transparent',
                border: 'none',
                color: '#ff4444',
                fontFamily: 'Chakra Petch',
                fontSize: '12px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              Delete
            </button>
          </>
        )}
      </div>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div
      style={{
        backgroundColor: '#030303',
        color: '#00ff41',
        fontFamily: 'Chakra Petch',
        padding: '24px',
        minHeight: '100vh',
      }}
    >
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid rgba(0, 255, 65, 0.2)' }}>
        <h1 style={{ fontFamily: 'Orbitron', color: '#00ff41', margin: 0, fontSize: '32px' }}>
          {operator.callsign} - PLANNER
        </h1>
        <button
          onClick={handleExportJson}
          style={{
            padding: '8px 16px',
            backgroundColor: '#00bcd4',
            color: '#000',
            border: 'none',
            fontFamily: 'Chakra Petch',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold',
          }}
        >
          Export JSON
        </button>
      </div>

      {/* VIEW MODE CONTROLS */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', justifyContent: 'center' }}>
        {(['month', 'week', 'day'] as ViewMode[]).map(mode => (
          <button
            key={mode}
            onClick={() => handleViewModeChange(mode)}
            style={{
              padding: '10px 20px',
              backgroundColor: viewMode === mode ? '#00ff41' : '#0a0a0a',
              color: viewMode === mode ? '#000' : '#00ff41',
              border: `2px solid ${viewMode === mode ? '#00ff41' : 'rgba(0, 255, 65, 0.3)'}`,
              fontFamily: 'Chakra Petch',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}
          >
            {mode}
          </button>
        ))}
      </div>

      {/* NAVIGATION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <button
          onClick={handleNavigatePrevious}
          style={{
            padding: '8px 16px',
            backgroundColor: '#0a0a0a',
            color: '#00ff41',
            border: '1px solid rgba(0, 255, 65, 0.3)',
            fontFamily: 'Chakra Petch',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold',
          }}
        >
          ← Previous
        </button>

        <button
          onClick={() => {
            setCurrentDate(new Date());
            setSelectedDate(null);
          }}
          style={{
            padding: '8px 16px',
            backgroundColor: '#0a0a0a',
            color: '#00ff41',
            border: '1px solid rgba(0, 255, 65, 0.3)',
            fontFamily: 'Chakra Petch',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold',
          }}
        >
          Today
        </button>

        <button
          onClick={handleNavigateNext}
          style={{
            padding: '8px 16px',
            backgroundColor: '#0a0a0a',
            color: '#00ff41',
            border: '1px solid rgba(0, 255, 65, 0.3)',
            fontFamily: 'Chakra Petch',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold',
          }}
        >
          Next →
        </button>
      </div>

      {/* CONTENT */}
      <div style={{ marginBottom: '24px' }}>
        {viewMode === 'month' && renderMonthView()}
        {viewMode === 'week' && renderWeekView()}
        {viewMode === 'day' && renderDayView()}
      </div>
    </div>
  );
};

export default Planner;
