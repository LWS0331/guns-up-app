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
  const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null);
  const [clipboard, setClipboard] = useState<Workout | null>(null);
  const [showDayTagEditor, setShowDayTagEditor] = useState<string | null>(null);
  const [tagNoteInput, setTagNoteInput] = useState('');
  const [selectedTagColor, setSelectedTagColor] = useState<'green' | 'amber' | 'red' | 'cyan'>('green');
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState('');
  const [exerciseSearchIndex, setExerciseSearchIndex] = useState(-1);
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
    return EXERCISE_LIBRARY.filter(ex => fuzzyMatch(query, ex.name))
      .slice(0, 8);
  };

  const getBlockLabels = (blocks: WorkoutBlock[]): string[] => {
    const labels: string[] = [];
    let currentLetter = 'A';

    for (let i = 0; i < blocks.length; i++) {
      const isLinkedToPrevious = i > 0 && blocks[i - 1].isLinkedToNext;
      const isLinkedToNext = blocks[i].isLinkedToNext;

      if (!isLinkedToPrevious) {
        currentLetter = String.fromCharCode(65 + labels.filter((_, idx) => !labels[idx].includes('1') && !labels[idx].includes('2')).length);
      }

      if (isLinkedToNext || isLinkedToPrevious) {
        const baseLabel = isLinkedToPrevious ? labels[i - 1].charAt(0) : currentLetter;
        const number = isLinkedToPrevious ? (parseInt(labels[i - 1].charAt(1)) || 1) + 1 : 1;
        labels.push(`${baseLabel}${number}`);
      } else {
        labels.push(currentLetter);
        currentLetter = String.fromCharCode(currentLetter.charCodeAt(0) + 1);
      }
    }

    return labels;
  };

  const findLastExerciseLog = (exerciseName: string): { date: string; prescription: string } | null => {
    const entries = Object.entries(operator.workouts)
      .sort(([dateA], [dateB]) => dateB.localeCompare(dateA));

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

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    setSelectedDate(null);
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

  const handleTodayClick = () => {
    setCurrentDate(new Date());
  };

  const handleDayClick = (date: Date) => {
    const dateStr = formatDate(date);
    const existing = getWorkoutForDate(date);

    if (existing) {
      setSelectedDate(dateStr);
      setViewMode('day');
      setEditingWorkout(null);
    } else {
      setSelectedDate(dateStr);
      setViewMode('day');
    }
  };

  const handleStartWorkout = (date: Date) => {
    const dateStr = formatDate(date);
    setSelectedDate(dateStr);
    setViewMode('day');
    setEditingWorkout({
      id: generateId(),
      date: selectedDate || formatDate(new Date()),
      title: '',
      notes: '',
      warmup: '',
      cooldown: '',
      blocks: [],
      completed: false,
    });
  };

  const handleStartRest = (date: Date) => {
    const dateStr = formatDate(date);
    const updated = { ...operator };
    updated.workouts[dateStr] = {
      id: generateId(),
      date: dateStr,
      title: 'REST DAY',
      notes: '',
      warmup: '',
      cooldown: '',
      blocks: [],
      completed: false,
    };
    onUpdateOperator(updated);
  };

  const handlePasteWorkout = (date: Date) => {
    if (!clipboard) return;
    const dateStr = formatDate(date);
    const updated = { ...operator };
    updated.workouts[dateStr] = {
      ...clipboard,
      id: generateId(),
      date: dateStr,
    };
    onUpdateOperator(updated);
  };

  const handleCopyWorkout = (date: Date) => {
    const workout = getWorkoutForDate(date);
    if (workout) {
      setClipboard(workout);
    }
  };

  const handleSaveWorkout = () => {
    if (!selectedDate || !editingWorkout) return;

    const updated = { ...operator };
    updated.workouts[selectedDate] = editingWorkout;
    onUpdateOperator(updated);

    setEditingWorkout(null);
    setSelectedDate(null);
  };

  const handleCancelWorkout = () => {
    setEditingWorkout(null);
    setSelectedDate(null);
  };

  const handleDeleteWorkout = (date: Date) => {
    const dateStr = formatDate(date);
    const updated = { ...operator };
    delete updated.workouts[dateStr];
    onUpdateOperator(updated);
  };

  const handleEditWorkout = (date: Date) => {
    const dateStr = formatDate(date);
    const workout = getWorkoutForDate(date);
    if (workout) {
      setSelectedDate(dateStr);
      setEditingWorkout({ ...workout });
      setViewMode('day');
    }
  };

  const handleAddExerciseBlock = () => {
    if (!editingWorkout) return;
    const newBlock: ExerciseBlock = {
      type: 'exercise',
      id: generateId(),
      sortOrder: editingWorkout.blocks.length,
      exerciseName: '',
      prescription: '',
      isLinkedToNext: false,
    };
    setEditingWorkout({
      ...editingWorkout,
      blocks: [...editingWorkout.blocks, newBlock],
    });
  };

  const handleAddConditioningBlock = () => {
    if (!editingWorkout) return;
    const newBlock: ConditioningBlock = {
      type: 'conditioning',
      id: generateId(),
      sortOrder: editingWorkout.blocks.length,
      format: '',
      description: '',
      isLinkedToNext: false,
    };
    setEditingWorkout({
      ...editingWorkout,
      blocks: [...editingWorkout.blocks, newBlock],
    });
  };

  const handleUpdateExerciseBlock = (index: number, updates: Partial<ExerciseBlock>) => {
    if (!editingWorkout) return;
    const newBlocks = [...editingWorkout.blocks];
    newBlocks[index] = { ...newBlocks[index], ...updates } as WorkoutBlock;
    setEditingWorkout({
      ...editingWorkout,
      blocks: newBlocks,
    });
  };

  const handleToggleSupersetLink = (index: number) => {
    if (!editingWorkout) return;
    const newBlocks = [...editingWorkout.blocks];
    newBlocks[index].isLinkedToNext = !newBlocks[index].isLinkedToNext;
    setEditingWorkout({
      ...editingWorkout,
      blocks: newBlocks,
    });
  };

  const handleDeleteExerciseBlock = (index: number) => {
    if (!editingWorkout) return;
    const newBlocks = editingWorkout.blocks.filter((_, i) => i !== index);
    setEditingWorkout({
      ...editingWorkout,
      blocks: newBlocks,
    });
  };

  const handleUpdateConditioningBlock = (globalBlockIndex: number, updates: Partial<ConditioningBlock>) => {
    if (!editingWorkout) return;
    const newBlocks = [...editingWorkout.blocks];
    newBlocks[globalBlockIndex] = { ...newBlocks[globalBlockIndex], ...updates } as WorkoutBlock;
    setEditingWorkout({
      ...editingWorkout,
      blocks: newBlocks,
    });
  };

  const handleDeleteConditioningBlock = (globalBlockIndex: number) => {
    if (!editingWorkout) return;
    const newBlocks = editingWorkout.blocks.filter((_, i) => i !== globalBlockIndex);
    setEditingWorkout({
      ...editingWorkout,
      blocks: newBlocks,
    });
  };

  const handleSelectExercise = (exerciseName: string, blockIndex: number) => {
    handleUpdateExerciseBlock(blockIndex, { exerciseName: exerciseName });
    setShowExerciseAutocomplete(false);
    setExerciseSearchQuery('');
    setAutocompleteFor(null);
  };

  const handleOpenTagEditor = (dateStr: string) => {
    const tag = getDayTag(dateStr);
    setShowDayTagEditor(dateStr);
    setSelectedTagColor((tag?.color as 'green' | 'amber' | 'red' | 'cyan') || 'green');
    setTagNoteInput(tag?.note || '');
  };

  const handleSaveTag = () => {
    if (!showDayTagEditor) return;
    const updated = { ...operator };
    if (!updated.dayTags) updated.dayTags = {};
    updated.dayTags[showDayTagEditor] = {
      color: selectedTagColor,
      note: tagNoteInput,
    };
    onUpdateOperator(updated);
    setShowDayTagEditor(null);
  };

  const handleDeleteTag = () => {
    if (!showDayTagEditor) return;
    const updated = { ...operator };
    if (updated.dayTags) {
      delete updated.dayTags[showDayTagEditor];
    }
    onUpdateOperator(updated);
    setShowDayTagEditor(null);
  };

  const handleExportCalendar = () => {
    const jsonStr = JSON.stringify(operator.workouts, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workouts-${formatDate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ============================================================================
  // STYLES
  // ============================================================================

  const colors = {
    bg: '#030303',
    green: '#00ff41',
    amber: '#ffb800',
    cyan: '#00bcd4',
    red: '#ff4444',
    darkGray: '#1a1a1a',
    medGray: '#333333',
    lightGray: '#555555',
  };

  const containerStyle: React.CSSProperties = {
    width: '100%',
    minHeight: '100vh',
    backgroundColor: colors.bg,
    color: colors.green,
    fontFamily: '"Chakra Petch", sans-serif',
    padding: '24px',
    overflow: 'auto',
  };

  const topBarStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '32px',
    gap: '24px',
  };

  const viewModesContainerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
  };

  const viewModeButtonStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 12px',
    backgroundColor: active ? colors.green : 'transparent',
    color: active ? colors.bg : colors.green,
    border: `1px solid ${active ? colors.green : colors.lightGray}`,
    fontFamily: '"Orbitron", sans-serif',
    fontSize: '8px',
    fontWeight: 600,
    letterSpacing: '1px',
    cursor: 'pointer',
    clipPath: 'polygon(10% 0%, 100% 0%, 90% 100%, 0% 100%)',
    transition: 'all 0.2s ease',
  });

  const navigationStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  };

  const navButtonStyle: React.CSSProperties = {
    backgroundColor: 'transparent',
    border: 'none',
    color: colors.green,
    cursor: 'pointer',
    fontSize: '18px',
    padding: '4px 8px',
    transition: 'all 0.2s ease',
  };

  const dateDisplayStyle: React.CSSProperties = {
    fontFamily: '"Orbitron", sans-serif',
    fontSize: '14px',
    fontWeight: 600,
    minWidth: '200px',
    textAlign: 'center',
    borderBottom: `1px solid rgba(0, 255, 65, 0.2)`,
    paddingBottom: '4px',
  };

  const todayButtonStyle: React.CSSProperties = {
    padding: '6px 12px',
    backgroundColor: 'transparent',
    color: colors.green,
    border: `1px solid rgba(0, 255, 65, 0.3)`,
    fontFamily: '"Chakra Petch", sans-serif',
    fontSize: '10px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  };

  const exportButtonStyle: React.CSSProperties = {
    padding: '6px 12px',
    backgroundColor: 'transparent',
    color: colors.green,
    border: `1px solid rgba(0, 255, 65, 0.3)`,
    fontFamily: '"Chakra Petch", sans-serif',
    fontSize: '10px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  };

  const monthGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '12px',
    marginBottom: '32px',
  };

  const weekDayHeaderStyle: React.CSSProperties = {
    fontFamily: '"Chakra Petch", sans-serif',
    fontSize: '9px',
    fontWeight: 600,
    color: colors.lightGray,
    textTransform: 'uppercase',
    textAlign: 'center',
    paddingBottom: '8px',
    borderBottom: `1px solid rgba(0, 255, 65, 0.1)`,
    letterSpacing: '1px',
  };

  const monthDayCellStyle = (isCurrentMonth: boolean, isCurrentDay: boolean): React.CSSProperties => ({
    minHeight: '100px',
    padding: '12px',
    backgroundColor: `rgba(0, 255, 65, ${isCurrentDay ? 0.08 : 0.02})`,
    border: `1px solid rgba(0, 255, 65, ${isCurrentDay ? 0.15 : 0.04})`,
    borderRadius: '2px',
    cursor: 'pointer',
    opacity: isCurrentMonth ? 1 : 0.3,
    transition: 'all 0.2s ease',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
  });

  const monthDayCellHoverStyle: React.CSSProperties = {
    backgroundColor: `rgba(0, 255, 65, 0.08)`,
    borderColor: `rgba(0, 255, 65, 0.15)`,
    boxShadow: 'none',
  };

  const dateLabelStyle = (isToday: boolean): React.CSSProperties => ({
    fontFamily: '"Share Tech Mono", monospace',
    fontSize: '11px',
    color: isToday ? colors.green : colors.lightGray,
    fontWeight: 600,
    textAlign: 'right',
    marginBottom: 'auto',
  });

  const cellContentStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  };

  const workoutTitleStyle: React.CSSProperties = {
    fontFamily: '"Chakra Petch", sans-serif',
    fontSize: '11px',
    fontWeight: 600,
    color: colors.green,
    borderLeft: `3px solid ${colors.green}`,
    paddingLeft: '6px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const blockCountStyle: React.CSSProperties = {
    fontFamily: '"Share Tech Mono", monospace',
    fontSize: '9px',
    color: colors.cyan,
    paddingLeft: '6px',
  };

  const tagDotStyle = (color: string): React.CSSProperties => ({
    position: 'absolute',
    top: '8px',
    left: '8px',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: color,
    cursor: 'pointer',
    border: `1px solid rgba(255, 255, 255, 0.3)`,
  });

  const dayViewContainerStyle: React.CSSProperties = {
    width: '100%',
    marginBottom: '32px',
  };

  const dayHeaderStyle: React.CSSProperties = {
    fontFamily: '"Orbitron", sans-serif',
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: '24px',
    paddingBottom: '12px',
    borderBottom: `1px solid rgba(0, 255, 65, 0.2)`,
  };

  const noOperationStyle: React.CSSProperties = {
    textAlign: 'center',
    padding: '48px 24px',
    color: colors.lightGray,
    fontFamily: '"Chakra Petch", sans-serif',
    fontSize: '14px',
  };

  const noOperationButtonsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '16px',
    justifyContent: 'center',
    marginTop: '24px',
  };

  const primaryButtonStyle: React.CSSProperties = {
    padding: '10px 20px',
    backgroundColor: colors.green,
    color: colors.bg,
    border: 'none',
    fontFamily: '"Chakra Petch", sans-serif',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  };

  const secondaryButtonStyle: React.CSSProperties = {
    padding: '10px 20px',
    backgroundColor: 'transparent',
    color: colors.amber,
    border: `1px solid ${colors.amber}`,
    fontFamily: '"Chakra Petch", sans-serif',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  };

  const tertiaryButtonStyle: React.CSSProperties = {
    padding: '10px 20px',
    backgroundColor: 'transparent',
    color: colors.cyan,
    border: `1px solid ${colors.cyan}`,
    fontFamily: '"Chakra Petch", sans-serif',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  };

  const workoutBuilderStyle: React.CSSProperties = {
    border: `1px solid rgba(0, 255, 65, 0.2)`,
    backgroundColor: `rgba(0, 255, 65, 0.02)`,
    padding: '24px',
    borderRadius: '2px',
  };

  const formGroupStyle: React.CSSProperties = {
    marginBottom: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  };

  const formLabelStyle: React.CSSProperties = {
    fontFamily: '"Orbitron", sans-serif',
    fontSize: '11px',
    fontWeight: 600,
    color: colors.green,
    textTransform: 'uppercase',
    letterSpacing: '1px',
  };

  const textInputStyle: React.CSSProperties = {
    padding: '10px 12px',
    backgroundColor: `rgba(0, 0, 0, 0.6)`,
    color: colors.green,
    border: `1px solid rgba(0, 255, 65, 0.2)`,
    fontFamily: '"Chakra Petch", sans-serif',
    fontSize: '12px',
    outline: 'none',
    transition: 'all 0.2s ease',
  };

  const textAreaStyle: React.CSSProperties = {
    padding: '10px 12px',
    backgroundColor: `rgba(0, 0, 0, 0.6)`,
    color: colors.green,
    border: `1px solid rgba(0, 255, 65, 0.2)`,
    fontFamily: '"Chakra Petch", sans-serif',
    fontSize: '11px',
    outline: 'none',
    resize: 'vertical',
    transition: 'all 0.2s ease',
  };

  const blocksStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '20px',
  };

  const exerciseBlockStyle = (isLinked: boolean): React.CSSProperties => ({
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    padding: '12px',
    backgroundColor: `rgba(0, 0, 0, 0.4)`,
    border: `1px solid ${isLinked ? 'rgba(255, 68, 68, 0.3)' : 'rgba(0, 255, 65, 0.1)'}`,
    borderLeft: `3px solid ${isLinked ? colors.red : 'transparent'}`,
    borderRadius: '2px',
  });

  const exerciseLabelStyle: React.CSSProperties = {
    fontFamily: '"Share Tech Mono", monospace',
    fontSize: '11px',
    fontWeight: 600,
    color: colors.cyan,
    minWidth: '30px',
    textAlign: 'center',
  };

  const exerciseInputContainerStyle: React.CSSProperties = {
    flex: 1,
    position: 'relative',
  };

  const exerciseInputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    backgroundColor: `rgba(0, 0, 0, 0.6)`,
    color: colors.green,
    border: `1px solid rgba(0, 255, 65, 0.2)`,
    fontFamily: '"Chakra Petch", sans-serif',
    fontSize: '11px',
    outline: 'none',
  };

  const autocompleteContainerStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: '4px',
    backgroundColor: colors.darkGray,
    border: `1px solid rgba(0, 255, 65, 0.3)`,
    borderRadius: '2px',
    zIndex: 100,
    maxHeight: '200px',
    overflowY: 'auto',
  };

  const autocompleteItemStyle: React.CSSProperties = {
    padding: '8px 12px',
    cursor: 'pointer',
    borderBottom: `1px solid rgba(0, 255, 65, 0.1)`,
    transition: 'all 0.2s ease',
  };

  const autocompleteItemHoverStyle: React.CSSProperties = {
    backgroundColor: `rgba(0, 255, 65, 0.1)`,
  };

  const exerciseNameStyle: React.CSSProperties = {
    fontFamily: '"Chakra Petch", sans-serif',
    fontSize: '11px',
    fontWeight: 600,
    color: colors.green,
  };

  const exerciseCategoryStyle: React.CSSProperties = {
    fontFamily: '"Chakra Petch", sans-serif',
    fontSize: '9px',
    color: colors.lightGray,
    marginTop: '2px',
  };

  const lastLogBannerStyle: React.CSSProperties = {
    marginTop: '6px',
    padding: '6px 8px',
    backgroundColor: `rgba(0, 255, 65, 0.08)`,
    border: `1px solid rgba(0, 255, 65, 0.2)`,
    borderRadius: '2px',
    fontFamily: '"Share Tech Mono", monospace',
    fontSize: '9px',
    color: colors.green,
  };

  const prescriptionInputStyle: React.CSSProperties = {
    width: '120px',
    padding: '8px 10px',
    backgroundColor: `rgba(0, 0, 0, 0.6)`,
    color: colors.green,
    border: `1px solid rgba(0, 255, 65, 0.2)`,
    fontFamily: '"Share Tech Mono", monospace',
    fontSize: '11px',
    outline: 'none',
  };

  const linkButtonStyle = (isLinked: boolean): React.CSSProperties => ({
    padding: '6px 8px',
    backgroundColor: 'transparent',
    color: isLinked ? colors.red : colors.cyan,
    border: `1px solid ${isLinked ? colors.red : colors.cyan}`,
    fontFamily: '"Chakra Petch", sans-serif',
    fontSize: '10px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  });

  const deleteButtonStyle: React.CSSProperties = {
    padding: '6px 8px',
    backgroundColor: 'transparent',
    color: colors.red,
    border: `1px solid ${colors.red}`,
    fontFamily: '"Chakra Petch", sans-serif',
    fontSize: '10px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  };

  const addButtonStyle = (color: string): React.CSSProperties => ({
    padding: '10px 16px',
    backgroundColor: 'transparent',
    color: color,
    border: `1px solid ${color}`,
    fontFamily: '"Chakra Petch", sans-serif',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    marginRight: '8px',
    marginBottom: '20px',
  });

  const conditioningBlockStyle: React.CSSProperties = {
    padding: '12px',
    backgroundColor: `rgba(0, 0, 0, 0.4)`,
    border: `1px solid rgba(255, 184, 0, 0.2)`,
    borderLeft: `3px solid ${colors.amber}`,
    borderRadius: '2px',
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
  };

  const conditioningInputStyle: React.CSSProperties = {
    width: '100px',
    padding: '8px 10px',
    backgroundColor: `rgba(0, 0, 0, 0.6)`,
    color: colors.amber,
    border: `1px solid rgba(255, 184, 0, 0.2)`,
    fontFamily: '"Share Tech Mono", monospace',
    fontSize: '11px',
    outline: 'none',
  };

  const conditioningDescStyle: React.CSSProperties = {
    flex: 1,
    padding: '8px 10px',
    backgroundColor: `rgba(0, 0, 0, 0.6)`,
    color: colors.amber,
    border: `1px solid rgba(255, 184, 0, 0.2)`,
    fontFamily: '"Chakra Petch", sans-serif',
    fontSize: '11px',
    outline: 'none',
    resize: 'vertical',
  };

  const workoutActionsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '12px',
    marginTop: '24px',
  };

  const cancelButtonStyle: React.CSSProperties = {
    padding: '10px 20px',
    backgroundColor: 'transparent',
    color: colors.lightGray,
    border: `1px solid rgba(85, 85, 85, 0.5)`,
    fontFamily: '"Chakra Petch", sans-serif',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  };

  const tagEditorOverlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  };

  const tagEditorStyle: React.CSSProperties = {
    backgroundColor: colors.darkGray,
    border: `1px solid rgba(0, 255, 65, 0.3)`,
    padding: '24px',
    borderRadius: '2px',
    minWidth: '300px',
  };

  const tagEditorHeaderStyle: React.CSSProperties = {
    fontFamily: '"Orbitron", sans-serif',
    fontSize: '12px',
    fontWeight: 600,
    marginBottom: '16px',
    color: colors.green,
  };

  const colorPickerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
  };

  const colorButtonStyle = (color: string, isSelected: boolean): React.CSSProperties => ({
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: color,
    border: isSelected ? `2px solid ${colors.green}` : '1px solid rgba(255, 255, 255, 0.2)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  });

  const tagNoteInputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    backgroundColor: `rgba(0, 0, 0, 0.6)`,
    color: colors.green,
    border: `1px solid rgba(0, 255, 65, 0.2)`,
    fontFamily: '"Chakra Petch", sans-serif',
    fontSize: '11px',
    marginBottom: '16px',
    outline: 'none',
  };

  const tagEditorActionsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '12px',
  };

  const dayActionButtonsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  };

  const dayActionButton = (color: string): React.CSSProperties => ({
    padding: '6px 12px',
    backgroundColor: 'transparent',
    color: color,
    border: `1px solid ${color}`,
    fontFamily: '"Chakra Petch", sans-serif',
    fontSize: '10px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  });

  // ============================================================================
  // RENDERING HELPERS
  // ============================================================================

  const renderTopBar = () => {
    let dateDisplay = '';

    if (viewMode === 'month') {
      dateDisplay = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else if (viewMode === 'week') {
      const weekDates = getWeekDates(currentDate);
      const startDate = weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endDate = weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dateDisplay = `${startDate} - ${endDate}`;
    } else {
      dateDisplay = currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    }

    return (
      <div style={topBarStyle}>
        <div style={viewModesContainerStyle}>
          {(['month', 'week', 'day'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => handleViewModeChange(mode)}
              style={viewModeButtonStyle(viewMode === mode)}
              onMouseEnter={e => {
                if (viewMode !== mode) {
                  Object.assign(e.currentTarget.style, { opacity: 0.8 });
                }
              }}
              onMouseLeave={e => {
                Object.assign(e.currentTarget.style, { opacity: 1 });
              }}
            >
              {mode.toUpperCase()}
            </button>
          ))}
        </div>

        <div style={navigationStyle}>
          <button
            onClick={handleNavigatePrevious}
            style={navButtonStyle}
            onMouseEnter={e => Object.assign(e.currentTarget.style, { opacity: 0.8 })}
            onMouseLeave={e => Object.assign(e.currentTarget.style, { opacity: 1 })}
          >
            ◄
          </button>
          <div style={dateDisplayStyle}>{dateDisplay}</div>
          <button
            onClick={handleNavigateNext}
            style={navButtonStyle}
            onMouseEnter={e => Object.assign(e.currentTarget.style, { opacity: 0.8 })}
            onMouseLeave={e => Object.assign(e.currentTarget.style, { opacity: 1 })}
          >
            ►
          </button>
          <button
            onClick={handleTodayClick}
            style={todayButtonStyle}
            onMouseEnter={e => Object.assign(e.currentTarget.style, { backgroundColor: `rgba(0, 255, 65, 0.1)` })}
            onMouseLeave={e => Object.assign(e.currentTarget.style, { backgroundColor: 'transparent' })}
          >
            TODAY
          </button>
        </div>

        <button
          onClick={handleExportCalendar}
          style={exportButtonStyle}
          onMouseEnter={e => Object.assign(e.currentTarget.style, { backgroundColor: `rgba(0, 255, 65, 0.1)` })}
          onMouseLeave={e => Object.assign(e.currentTarget.style, { backgroundColor: 'transparent' })}
        >
          EXPORT
        </button>
      </div>
    );
  };

  const renderMonthView = () => {
    const monthDates = getMonthDates(currentDate);

    return (
      <div>
        <div style={monthGridStyle}>
          {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(day => (
            <div key={day} style={weekDayHeaderStyle}>
              {day}
            </div>
          ))}

          {monthDates.map((week, weekIdx) =>
            week.map((date, dayIdx) => {
              const dateStr = formatDate(date);
              const workout = getWorkoutForDate(date);
              const tag = getDayTag(dateStr);
              const isCurrent = isCurrentMonth(date);
              const isCurrentDay = isToday(date);
              const [hovering, setHovering] = React.useState(false);

              return (
                <div
                  key={`${weekIdx}-${dayIdx}`}
                  style={{
                    ...monthDayCellStyle(isCurrent, isCurrentDay),
                    ...(hovering && !workout ? monthDayCellHoverStyle : {}),
                  }}
                  onClick={() => workout && handleDayClick(date)}
                  onMouseEnter={() => !isCurrent && setHovering(true)}
                  onMouseLeave={() => setHovering(false)}
                >
                  {tag && (
                    <div
                      style={tagDotStyle(
                        tag.color === 'green' ? colors.green :
                        tag.color === 'amber' ? colors.amber :
                        tag.color === 'red' ? colors.red :
                        colors.cyan
                      )}
                      onClick={e => {
                        e.stopPropagation();
                        handleOpenTagEditor(dateStr);
                      }}
                    />
                  )}

                  <div style={dateLabelStyle(isCurrentDay)}>
                    {date.getDate()}
                  </div>

                  {workout ? (
                    <div style={cellContentStyle}>
                      <div style={workoutTitleStyle}>{workout.title}</div>
                      <div style={blockCountStyle}>
                        {workout.blocks.filter(b => b.type === 'exercise').length > 0 && `${workout.blocks.filter(b => b.type === 'exercise').length}E`}
                        {workout.blocks.filter(b => b.type === 'conditioning').length > 0 && `${workout.blocks.filter(b => b.type === 'conditioning').length}C`}
                      </div>
                    </div>
                  ) : (
                    hovering && isCurrent && (
                      <div style={dayActionButtonsStyle}>
                        <button
                          style={dayActionButton(colors.green)}
                          onClick={e => {
                            e.stopPropagation();
                            handleStartWorkout(date);
                          }}
                        >
                          WOD
                        </button>
                        <button
                          style={dayActionButton(colors.amber)}
                          onClick={e => {
                            e.stopPropagation();
                            handleStartRest(date);
                          }}
                        >
                          REST
                        </button>
                        {clipboard && (
                          <button
                            style={dayActionButton(colors.cyan)}
                            onClick={e => {
                              e.stopPropagation();
                              handlePasteWorkout(date);
                            }}
                          >
                            PASTE
                          </button>
                        )}
                      </div>
                    )
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const weekDates = getWeekDates(currentDate);

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '12px' }}>
        {weekDates.map(date => {
          const dateStr = formatDate(date);
          const workout = getWorkoutForDate(date);
          const tag = getDayTag(dateStr);
          const isCurrentDay = isToday(date);
          const [hovering, setHovering] = React.useState(false);

          return (
            <div
              key={dateStr}
              style={{
                ...monthDayCellStyle(true, isCurrentDay),
                minHeight: '200px',
                ...(hovering && !workout ? monthDayCellHoverStyle : {}),
              }}
              onClick={() => workout && handleDayClick(date)}
              onMouseEnter={() => setHovering(true)}
              onMouseLeave={() => setHovering(false)}
            >
              {tag && (
                <div
                  style={tagDotStyle(
                    tag.color === 'green' ? colors.green :
                    tag.color === 'amber' ? colors.amber :
                    tag.color === 'red' ? colors.red :
                    colors.cyan
                  )}
                  onClick={e => {
                    e.stopPropagation();
                    handleOpenTagEditor(dateStr);
                  }}
                />
              )}

              <div style={{ ...dateLabelStyle(isCurrentDay), marginBottom: '8px' }}>
                {date.toLocaleDateString('en-US', { weekday: 'short' })}<br />
                {date.getDate()}
              </div>

              {workout ? (
                <div style={cellContentStyle}>
                  <div style={workoutTitleStyle}>{workout.title}</div>
                  <div style={blockCountStyle}>
                    {workout.blocks.filter(b => b.type === 'exercise').length > 0 && `${workout.blocks.filter(b => b.type === 'exercise').length}E`}
                    {workout.blocks.filter(b => b.type === 'conditioning').length > 0 && ` ${workout.blocks.filter(b => b.type === 'conditioning').length}C`}
                  </div>
                </div>
              ) : (
                hovering && (
                  <div style={dayActionButtonsStyle}>
                    <button
                      style={dayActionButton(colors.green)}
                      onClick={e => {
                        e.stopPropagation();
                        handleStartWorkout(date);
                      }}
                    >
                      WOD
                    </button>
                    <button
                      style={dayActionButton(colors.amber)}
                      onClick={e => {
                        e.stopPropagation();
                        handleStartRest(date);
                      }}
                    >
                      REST
                    </button>
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderDayView = () => {
    if (!selectedDate) return null;

    const selectedDateObj = parseDate(selectedDate);
    const workout = getWorkoutForDate(selectedDate) || editingWorkout;

    if (!workout && !editingWorkout) {
      return (
        <div style={dayViewContainerStyle}>
          <div style={dayHeaderStyle}>
            {selectedDateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
          <div style={noOperationStyle}>
            <div>NO OPERATION SCHEDULED</div>
            <div style={noOperationButtonsStyle}>
              <button
                style={primaryButtonStyle}
                onClick={() => handleStartWorkout(selectedDateObj)}
                onMouseEnter={e => Object.assign(e.currentTarget.style, { opacity: 0.9 })}
                onMouseLeave={e => Object.assign(e.currentTarget.style, { opacity: 1 })}
              >
                + WOD
              </button>
              <button
                style={secondaryButtonStyle}
                onClick={() => handleStartRest(selectedDateObj)}
                onMouseEnter={e => Object.assign(e.currentTarget.style, { opacity: 0.9 })}
                onMouseLeave={e => Object.assign(e.currentTarget.style, { opacity: 1 })}
              >
                REST DAY
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (editingWorkout) {
      const labels = getBlockLabels(editingWorkout.blocks);

      return (
        <div style={dayViewContainerStyle}>
          <div style={dayHeaderStyle}>
            {selectedDateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>

          <div style={workoutBuilderStyle}>
            <div style={formGroupStyle}>
              <label style={formLabelStyle}>Operation Title</label>
              <input
                type="text"
                style={textInputStyle}
                placeholder="Operation Title"
                value={editingWorkout.title}
                onChange={e => setEditingWorkout({ ...editingWorkout, title: e.target.value })}
                onFocus={e => Object.assign(e.currentTarget.style, { borderColor: `rgba(0, 255, 65, 0.5)` })}
                onBlur={e => Object.assign(e.currentTarget.style, { borderColor: `rgba(0, 255, 65, 0.2)` })}
              />
            </div>

            <div style={formGroupStyle}>
              <label style={formLabelStyle}>Notes</label>
              <textarea
                style={textAreaStyle}
                placeholder="Commander's Notes"
                rows={2}
                value={editingWorkout.notes}
                onChange={e => setEditingWorkout({ ...editingWorkout, notes: e.target.value })}
                onFocus={e => Object.assign(e.currentTarget.style, { borderColor: `rgba(0, 255, 65, 0.5)` })}
                onBlur={e => Object.assign(e.currentTarget.style, { borderColor: `rgba(0, 255, 65, 0.2)` })}
              />
            </div>

            <div style={formGroupStyle}>
              <label style={formLabelStyle}>Warmup</label>
              <textarea
                style={textAreaStyle}
                placeholder="Warmup protocol..."
                rows={3}
                value={editingWorkout.warmup}
                onChange={e => setEditingWorkout({ ...editingWorkout, warmup: e.target.value })}
                onFocus={e => Object.assign(e.currentTarget.style, { borderColor: `rgba(0, 255, 65, 0.5)` })}
                onBlur={e => Object.assign(e.currentTarget.style, { borderColor: `rgba(0, 255, 65, 0.2)` })}
              />
            </div>

            {editingWorkout.blocks.filter(b => b.type === 'exercise').length > 0 && (
              <div>
                <label style={formLabelStyle}>Exercise Blocks</label>
                <div style={blocksStyle}>
                  {editingWorkout.blocks.filter(b => b.type === 'exercise').map((block, idx) => {
                    const lastLog = findLastExerciseLog((block as ExerciseBlock).exerciseName);
                    const filteredExercises = showExerciseAutocomplete && autocompleteFor === idx ? getFilteredExercises(exerciseSearchQuery) : [];

                    return (
                      <div key={block.id}>
                        <div style={exerciseBlockStyle((block as ExerciseBlock).isLinkedToNext)}>
                          <div style={exerciseLabelStyle}>{labels[idx]}</div>

                          <div style={exerciseInputContainerStyle}>
                            <input
                              type="text"
                              style={exerciseInputStyle}
                              placeholder="Exercise name"
                              value={(block as ExerciseBlock).exerciseName}
                              onChange={e => {
                                handleUpdateExerciseBlock(idx, { exerciseName: e.target.value });
                                setExerciseSearchQuery(e.target.value);
                                setShowExerciseAutocomplete(e.target.value.length > 0);
                                setAutocompleteFor(idx);
                              }}
                              onFocus={() => {
                                setShowExerciseAutocomplete(true);
                                setAutocompleteFor(idx);
                              }}
                              onBlur={() => setTimeout(() => setShowExerciseAutocomplete(false), 150)}
                            />

                            {showExerciseAutocomplete && autocompleteFor === idx && filteredExercises.length > 0 && (
                              <div style={autocompleteContainerStyle} ref={autocompleteRef}>
                                {filteredExercises.map(exercise => (
                                  <div
                                    key={exercise.id}
                                    style={autocompleteItemStyle}
                                    onClick={() => handleSelectExercise(exercise.name, idx)}
                                    onMouseEnter={e => Object.assign(e.currentTarget.style, autocompleteItemHoverStyle)}
                                    onMouseLeave={e => Object.assign(e.currentTarget.style, { backgroundColor: 'transparent' })}
                                  >
                                    <div style={exerciseNameStyle}>{exercise.name}</div>
                                    <div style={exerciseCategoryStyle}>{exercise.category} • {exercise.equipment}</div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {lastLog && (
                              <div style={lastLogBannerStyle}>
                                Last logged: {lastLog.date} — {lastLog.prescription}
                              </div>
                            )}
                          </div>

                          <input
                            type="text"
                            style={prescriptionInputStyle}
                            placeholder="Prescription"
                            value={block.prescription}
                            onChange={e => handleUpdateExerciseBlock(idx, { prescription: e.target.value })}
                            onFocus={e => Object.assign(e.currentTarget.style, { borderColor: `rgba(0, 255, 65, 0.5)` })}
                            onBlur={e => Object.assign(e.currentTarget.style, { borderColor: `rgba(0, 255, 65, 0.2)` })}
                          />

                          <button
                            style={linkButtonStyle(block.isLinkedToNext)}
                            onClick={() => handleToggleSupersetLink(idx)}
                            onMouseEnter={e => Object.assign(e.currentTarget.style, { opacity: 0.8 })}
                            onMouseLeave={e => Object.assign(e.currentTarget.style, { opacity: 1 })}
                          >
                            {block.isLinkedToNext ? 'UNLINK' : 'LINK'}
                          </button>

                          <button
                            style={deleteButtonStyle}
                            onClick={() => handleDeleteExerciseBlock(idx)}
                            onMouseEnter={e => Object.assign(e.currentTarget.style, { opacity: 0.8 })}
                            onMouseLeave={e => Object.assign(e.currentTarget.style, { opacity: 1 })}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              style={addButtonStyle(colors.green)}
              onClick={handleAddExerciseBlock}
              onMouseEnter={e => Object.assign(e.currentTarget.style, { backgroundColor: `rgba(0, 255, 65, 0.1)` })}
              onMouseLeave={e => Object.assign(e.currentTarget.style, { backgroundColor: 'transparent' })}
            >
              + EXERCISE
            </button>

            {editingWorkout.blocks.filter(b => b.type === 'conditioning').length > 0 && (
              <div style={blocksStyle}>
                {editingWorkout.blocks.map((block, globalIdx) =>
                  block.type === 'conditioning' ? (
                    <div key={block.id} style={conditioningBlockStyle}>
                      <input
                        type="text"
                        style={conditioningInputStyle}
                        placeholder="Format"
                        value={(block as ConditioningBlock).format}
                        onChange={e => handleUpdateConditioningBlock(globalIdx, { format: e.target.value })}
                        onFocus={e => Object.assign(e.currentTarget.style, { borderColor: `rgba(255, 184, 0, 0.5)` })}
                        onBlur={e => Object.assign(e.currentTarget.style, { borderColor: `rgba(255, 184, 0, 0.2)` })}
                      />
                      <textarea
                        style={conditioningDescStyle}
                        placeholder="Description"
                        rows={2}
                        value={(block as ConditioningBlock).description}
                        onChange={e => handleUpdateConditioningBlock(globalIdx, { description: e.target.value })}
                        onFocus={e => Object.assign(e.currentTarget.style, { borderColor: `rgba(255, 184, 0, 0.5)` })}
                        onBlur={e => Object.assign(e.currentTarget.style, { borderColor: `rgba(255, 184, 0, 0.2)` })}
                      />
                      <button
                        style={deleteButtonStyle}
                        onClick={() => handleDeleteConditioningBlock(globalIdx)}
                        onMouseEnter={e => Object.assign(e.currentTarget.style, { opacity: 0.8 })}
                        onMouseLeave={e => Object.assign(e.currentTarget.style, { opacity: 1 })}
                      >
                        ✕
                      </button>
                    </div>
                  ) : null
                )}
              </div>
            )}

            <button
              style={addButtonStyle(colors.amber)}
              onClick={handleAddConditioningBlock}
              onMouseEnter={e => Object.assign(e.currentTarget.style, { backgroundColor: `rgba(255, 184, 0, 0.1)` })}
              onMouseLeave={e => Object.assign(e.currentTarget.style, { backgroundColor: 'transparent' })}
            >
              + CONDITIONING
            </button>

            <div style={formGroupStyle}>
              <label style={formLabelStyle}>Cooldown</label>
              <textarea
                style={textAreaStyle}
                placeholder="Cooldown protocol..."
                rows={3}
                value={editingWorkout.cooldown}
                onChange={e => setEditingWorkout({ ...editingWorkout, cooldown: e.target.value })}
                onFocus={e => Object.assign(e.currentTarget.style, { borderColor: `rgba(0, 255, 65, 0.5)` })}
                onBlur={e => Object.assign(e.currentTarget.style, { borderColor: `rgba(0, 255, 65, 0.2)` })}
              />
            </div>

            <div style={workoutActionsStyle}>
              <button
                style={primaryButtonStyle}
                onClick={handleSaveWorkout}
                onMouseEnter={e => Object.assign(e.currentTarget.style, { opacity: 0.9 })}
                onMouseLeave={e => Object.assign(e.currentTarget.style, { opacity: 1 })}
              >
                SAVE WORKOUT
              </button>
              <button
                style={cancelButtonStyle}
                onClick={handleCancelWorkout}
                onMouseEnter={e => Object.assign(e.currentTarget.style, { backgroundColor: `rgba(85, 85, 85, 0.1)` })}
                onMouseLeave={e => Object.assign(e.currentTarget.style, { backgroundColor: 'transparent' })}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (workout) {
      return (
        <div style={dayViewContainerStyle}>
          <div style={dayHeaderStyle}>
            {selectedDateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>

          <div style={{ ...workoutBuilderStyle, border: `1px solid rgba(0, 255, 65, 0.3)` }}>
            <div style={{ ...formGroupStyle, marginBottom: '24px' }}>
              <div style={{ ...formLabelStyle, marginBottom: '8px' }}>{workout.title}</div>
              {workout.notes && (
                <div style={{ fontFamily: '"Chakra Petch", sans-serif', fontSize: '11px', color: colors.lightGray }}>
                  {workout.notes}
                </div>
              )}
            </div>

            {workout.warmup && (
              <div style={formGroupStyle}>
                <div style={formLabelStyle}>Warmup</div>
                <div style={{ fontFamily: '"Chakra Petch", sans-serif', fontSize: '11px', color: colors.lightGray, whiteSpace: 'pre-wrap' }}>
                  {workout.warmup}
                </div>
              </div>
            )}

            {workout.blocks.filter(b => b.type === 'exercise').length > 0 && (
              <div style={formGroupStyle}>
                <div style={formLabelStyle}>Exercises</div>
                {workout.blocks.filter(b => b.type === 'exercise').map((block, idx) => (
                  <div key={block.id} style={{ paddingLeft: '12px', marginBottom: '8px' }}>
                    <div style={{ ...exerciseNameStyle, marginBottom: '4px' }}>
                      {(block as ExerciseBlock).exerciseName} • {(block as ExerciseBlock).prescription}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {workout.blocks.filter(b => b.type === 'conditioning').length > 0 && (
              <div style={formGroupStyle}>
                <div style={formLabelStyle}>Conditioning</div>
                {workout.blocks.filter(b => b.type === 'conditioning').map((block, idx) => (
                  <div key={block.id} style={{ paddingLeft: '12px', marginBottom: '8px' }}>
                    <div style={{ ...exerciseNameStyle, color: colors.amber, marginBottom: '4px' }}>
                      {(block as ConditioningBlock).format}
                    </div>
                    <div style={{ fontFamily: '"Chakra Petch", sans-serif', fontSize: '10px', color: colors.lightGray }}>
                      {(block as ConditioningBlock).description}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {workout.cooldown && (
              <div style={formGroupStyle}>
                <div style={formLabelStyle}>Cooldown</div>
                <div style={{ fontFamily: '"Chakra Petch", sans-serif', fontSize: '11px', color: colors.lightGray, whiteSpace: 'pre-wrap' }}>
                  {workout.cooldown}
                </div>
              </div>
            )}

            <div style={workoutActionsStyle}>
              <button
                style={{ ...secondaryButtonStyle, marginRight: '8px' }}
                onClick={() => handleEditWorkout(selectedDateObj)}
                onMouseEnter={e => Object.assign(e.currentTarget.style, { backgroundColor: `rgba(255, 184, 0, 0.1)` })}
                onMouseLeave={e => Object.assign(e.currentTarget.style, { backgroundColor: 'transparent' })}
              >
                EDIT
              </button>
              <button
                style={{ ...tertiaryButtonStyle, marginRight: '8px' }}
                onClick={() => handleCopyWorkout(selectedDateObj)}
                onMouseEnter={e => Object.assign(e.currentTarget.style, { backgroundColor: `rgba(0, 188, 212, 0.1)` })}
                onMouseLeave={e => Object.assign(e.currentTarget.style, { backgroundColor: 'transparent' })}
              >
                COPY
              </button>
              <button
                style={deleteButtonStyle}
                onClick={() => {
                  handleDeleteWorkout(selectedDateObj);
                  setSelectedDate(null);
                  setViewMode('month');
                }}
                onMouseEnter={e => Object.assign(e.currentTarget.style, { backgroundColor: `rgba(255, 68, 68, 0.1)` })}
                onMouseLeave={e => Object.assign(e.currentTarget.style, { backgroundColor: 'transparent' })}
              >
                DELETE
              </button>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  const renderTagEditor = () => {
    if (!showDayTagEditor) return null;

    return (
      <div
        style={tagEditorOverlayStyle}
        onClick={() => setShowDayTagEditor(null)}
      >
        <div
          style={tagEditorStyle}
          onClick={e => e.stopPropagation()}
        >
          <div style={tagEditorHeaderStyle}>
            Tag: {showDayTagEditor}
          </div>

          <div style={colorPickerStyle}>
            {(['green', 'amber', 'red', 'cyan'] as const).map(color => (
              <button
                key={color}
                style={colorButtonStyle(
                  color === 'green' ? colors.green :
                  color === 'amber' ? colors.amber :
                  color === 'red' ? colors.red :
                  colors.cyan,
                  selectedTagColor === color
                )}
                onClick={() => setSelectedTagColor(color)}
              />
            ))}
          </div>

          <input
            type="text"
            style={tagNoteInputStyle}
            placeholder="Tag note (optional)"
            value={tagNoteInput}
            onChange={e => setTagNoteInput(e.target.value)}
            onFocus={e => Object.assign(e.currentTarget.style, { borderColor: `rgba(0, 255, 65, 0.5)` })}
            onBlur={e => Object.assign(e.currentTarget.style, { borderColor: `rgba(0, 255, 65, 0.2)` })}
          />

          <div style={tagEditorActionsStyle}>
            <button
              style={primaryButtonStyle}
              onClick={handleSaveTag}
              onMouseEnter={e => Object.assign(e.currentTarget.style, { opacity: 0.9 })}
              onMouseLeave={e => Object.assign(e.currentTarget.style, { opacity: 1 })}
            >
              SAVE
            </button>
            <button
              style={deleteButtonStyle}
              onClick={handleDeleteTag}
              onMouseEnter={e => Object.assign(e.currentTarget.style, { opacity: 0.8 })}
              onMouseLeave={e => Object.assign(e.currentTarget.style, { opacity: 1 })}
            >
              DELETE
            </button>
            <button
              style={cancelButtonStyle}
              onClick={() => setShowDayTagEditor(null)}
              onMouseEnter={e => Object.assign(e.currentTarget.style, { backgroundColor: `rgba(85, 85, 85, 0.1)` })}
              onMouseLeave={e => Object.assign(e.currentTarget.style, { backgroundColor: 'transparent' })}
            >
              CLOSE
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div style={containerStyle}>
      {renderTopBar()}

      {selectedDate && viewMode === 'day' ? (
        renderDayView()
      ) : (
        <>
          {viewMode === 'month' && renderMonthView()}
          {viewMode === 'week' && renderWeekView()}
        </>
      )}

      {renderTagEditor()}
    </div>
  );
};

export default Planner;
