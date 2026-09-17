"use client";
import NextImage from 'next/image';

import { readData } from '../../services/workspace-data.mjs';

import React, { useState, useEffect, useRef } from 'react';
import {
    Briefcase, Plus, MoreHorizontal, Clock, Calendar, MessageSquare, Paperclip, CheckCircle,
    UserCheck, Filter, X, Check, ShieldAlert, Sparkles
} from 'lucide-react';
import styles from './ProjectView.module.css';
import { useHRMS } from '@/context/HRMSContext';
import { useAuth } from '@/context/AuthContext';

const DEFAULT_PROJECTS = [
    { id: 'proj-1', title: 'Platform Core', desc: 'Core infrastructure & API endpoints', due: '2026-10-31', color: 'var(--signal)', visibility: 'all', members: ['Alex Morgan', 'Sarah Jenkins'] },
    { id: 'proj-2', title: 'Payroll Modernization', desc: 'Autonomous calculation and GL export engine', due: '2026-11-15', color: 'var(--status-ok)', visibility: 'all', members: ['David Chen'] },
];

const DEFAULT_TASKS = {
    todo: [
        { id: 'task-1', title: 'Design System Tokens Audit', project: 'Platform Core', assignee: 'Alex Morgan', priority: 'high', due: 'Tomorrow', tag: 'UI/UX' },
        { id: 'task-2', title: 'Neon Database Schema Sync', project: 'Platform Core', assignee: 'Sarah Jenkins', priority: 'urgent', due: 'Friday', tag: 'Backend' },
    ],
    inprogress: [
        { id: 'task-3', title: 'Workforce Timesheet API', project: 'Platform Core', assignee: 'David Chen', priority: 'medium', due: 'In 2 days', tag: 'API' },
    ],
    review: [
        { id: 'task-4', title: 'EWA Approval Workflow', project: 'Platform Core', assignee: 'Elena Rostova', priority: 'high', due: 'Today', tag: 'Security' },
    ],
    done: [
        { id: 'task-5', title: 'Role Based Access Control Matrix', project: 'Platform Core', assignee: 'Alex Morgan', priority: 'medium', due: 'Yesterday', tag: 'Auth' },
    ]
};

const ProjectView = () => {
    const { employees = [], showToast } = useHRMS();
    const { user } = useAuth();

    const [projectList, setProjectList] = useState(DEFAULT_PROJECTS);
    const [kanbanTasks, setKanbanTasks] = useState(DEFAULT_TASKS);

    useEffect(() => {
        let active = true;
        Promise.allSettled([
            fetch('/api/v1/projects'),
            fetch('/api/v1/projects/tasks')
        ]).then(async ([projRes, taskRes]) => {
            if (!active) return;
            if (projRes.status === 'fulfilled' && projRes.value.ok) {
                const projData = await projRes.value.json().catch(() => null);
                const items = Array.isArray(projData?.items) ? projData.items : (Array.isArray(projData?.data) ? projData.data : []);
                if (items.length > 0) {
                    const formattedProjs = items.map(p => ({
                        id: p.id,
                        title: p.title || p.name || 'Enterprise Project',
                        desc: p.desc || p.description || 'Enterprise project workspace',
                        due: p.due || p.endDate || '2026-12-31',
                        color: p.color || 'var(--signal)',
                        visibility: p.visibility || 'all',
                        members: Array.isArray(p.members) ? p.members : ['Alex Morgan']
                    }));
                    setProjectList(prev => {
                        const dbIds = new Set(formattedProjs.map(f => f.id));
                        const remaining = DEFAULT_PROJECTS.filter(d => !dbIds.has(d.id));
                        return [...formattedProjs, ...remaining];
                    });
                }
            }

            if (taskRes.status === 'fulfilled' && taskRes.value.ok) {
                const taskData = await taskRes.value.json().catch(() => null);
                const taskItems = Array.isArray(taskData?.items) ? taskData.items : (Array.isArray(taskData?.data) ? taskData.data : []);
                if (taskItems.length > 0) {
                    setKanbanTasks(prev => {
                        const next = {
                            todo: [...(DEFAULT_TASKS.todo || [])],
                            inprogress: [...(DEFAULT_TASKS.inprogress || [])],
                            review: [...(DEFAULT_TASKS.review || [])],
                            done: [...(DEFAULT_TASKS.done || [])]
                        };
                        taskItems.forEach(t => {
                            const col = (t.column || 'todo').toLowerCase().replace('-', '');
                            const targetCol = next[col] ? col : 'todo';
                            const formattedTask = {
                                id: t.id,
                                title: t.title || 'Task',
                                project: t.project || 'Platform Core',
                                assignee: t.assignee || 'Alex Morgan',
                                priority: (t.priority || 'medium').toLowerCase(),
                                due: t.due || 'Upcoming',
                                tag: t.tag || 'Ops'
                            };
                            if (!next[targetCol].some(ex => ex.id === formattedTask.id)) {
                                next[targetCol].unshift(formattedTask);
                            }
                        });
                        return next;
                    });
                }
            }
        }).catch(err => console.warn('Project view db sync notice:', err));
        return () => { active = false; };
    }, []);

    const [selectedProjectId, setSelectedProjectId] = useState('proj-1');
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
    const [filterMyTasks, setFilterMyTasks] = useState(false);

    // New Project Form State
    const [newProjTitle, setNewProjTitle] = useState('');
    const [newProjDesc, setNewProjDesc] = useState('');
    const [newProjDue, setNewProjDue] = useState(readData("components.Workspace.ProjectView", "initialState_1"));
    const [newProjColor, setNewProjColor] = useState(readData("components.Workspace.ProjectView", "initialState_2"));
    const [newProjVisibility, setNewProjVisibility] = useState(readData("components.Workspace.ProjectView", "initialState_3")); // 'all', 'team', 'private'
    const [newProjMembers, setNewProjMembers] = useState(readData("components.Workspace.ProjectView", "newProjMembers_1"));

    // New Task Form State
    const [taskTitle, setTaskTitle] = useState('');
    const [taskProject, setTaskProject] = useState(readData("components.Workspace.ProjectView", "initialState_4"));
    const [taskAssignee, setTaskAssignee] = useState(user?.name || readData("components.Workspace.ProjectView", "fallback_2"));
    const [taskTag, setTaskTag] = useState(readData("components.Workspace.ProjectView", "initialState_5"));
    const [taskPriority, setTaskPriority] = useState(readData("components.Workspace.ProjectView", "initialState_6"));
    const [taskDue, setTaskDue] = useState(readData("components.Workspace.ProjectView", "initialState_7"));

    const activeUserName = (user?.name || readData("components.Workspace.ProjectView", "fallback_3")).toLowerCase();
    const isAdminOrHR = readData("components.Workspace.ProjectView", "isAdminOrHR_2").includes(user?.role);

    const visibleProjects = projectList.filter(proj => {
        if (isAdminOrHR) return true;
        if (proj.visibility === 'all') return true;
        if (proj.createdBy && proj.createdBy.toLowerCase().includes(activeUserName)) return true;
        if (proj.members && proj.members.some(m => m.toLowerCase().includes(activeUserName) || activeUserName.includes(m.toLowerCase()))) return true;

        const hasAssignedTask = Object.values(kanbanTasks).some(col =>
            (col || []).some(t =>
                (t.project === proj.title || t.project === proj.id) &&
                ((t.assignee || '').toLowerCase().includes(activeUserName) || activeUserName.includes((t.assignee || '').toLowerCase()))
            )
        );
        return hasAssignedTask;
    });

    const activeProject = visibleProjects.find(p => p.id === selectedProjectId) || visibleProjects[0] || projectList[0];

    const isSubmittingProj = useRef(false);
    const handleCreateProject = async (e) => {
        e?.preventDefault?.();
        if (!newProjTitle.trim() || isSubmittingProj.current) return;
        isSubmittingProj.current = true;

        const newP = {
            id: `proj-${Date.now()}`,
            title: newProjTitle.trim(),
            desc: newProjDesc.trim() || readData("components.Workspace.ProjectView", "fallback_4"),
            due: newProjDue,
            color: newProjColor || 'var(--signal)',
            visibility: newProjVisibility,
            members: newProjMembers
        };

        setProjectList(prev => [newP, ...prev]);
        setSelectedProjectId(newP.id);
        setTaskProject(newP.title);

        try {
            await fetch('/api/v1/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
                body: JSON.stringify(newP)
            });
            showToast?.('Project Created', `Project ${newP.title} saved to DB.`, 'success');
        } catch (err) {
            console.warn('Project create sync warning:', err);
        } finally {
            setTimeout(() => { isSubmittingProj.current = false; }, 500);
        }

        setNewProjTitle('');
        setNewProjDesc('');
        setIsCreateProjectModalOpen(false);
    };

    const isSubmittingTask = useRef(false);
    const handleCreateTask = async (e) => {
        e?.preventDefault?.();
        if (!taskTitle.trim() || isSubmittingTask.current) return;
        isSubmittingTask.current = true;

        const newT = {
            id: `task-${Date.now()}`,
            title: taskTitle.trim(),
            project: taskProject || activeProject?.title || readData("components.Workspace.ProjectView", "fallback_5"),
            assignee: taskAssignee,
            tag: taskTag,
            priority: taskPriority,
            due: taskDue,
            column: 'todo'
        };

        setKanbanTasks(prev => ({
            ...prev,
            todo: [newT, ...(prev.todo || [])]
        }));

        try {
            await fetch('/api/v1/projects/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
                body: JSON.stringify(newT)
            });
            showToast?.('Task Created', `Task created under ${newT.project}.`, 'success');
        } catch (err) {
            console.warn('Task create sync warning:', err);
        } finally {
            setTimeout(() => { isSubmittingTask.current = false; }, 500);
        }

        setTaskTitle('');
        setIsAssignModalOpen(false);
    };

    const filterFn = (task) => {
        const taskProj = task.project || readData("components.Workspace.ProjectView", "fallback_6");
        const matchesProject = taskProj === activeProject?.title || taskProj === activeProject?.id;
        if (!matchesProject) return false;

        if (filterMyTasks) {
            return (task.assignee || '').toLowerCase().includes(activeUserName) ||
                activeUserName.includes((task.assignee || '').toLowerCase());
        }
        return true;
    };

    const displayTasks = {
        todo: (kanbanTasks.todo || []).filter(filterFn),
        inprogress: (kanbanTasks.inprogress || []).filter(filterFn),
        review: (kanbanTasks.review || []).filter(filterFn),
        done: (kanbanTasks.done || []).filter(filterFn)
    };

    const columnOrder = readData("components.Workspace.ProjectView", "columnOrder_3");

    const moveTaskState = async (taskId, currentCol, targetCol) => {
        let movedTask = null;
        setKanbanTasks(prev => {
            const currentList = prev[currentCol] || [];
            const task = currentList.find(t => t.id === taskId);
            if (!task) return prev;
            movedTask = { ...task, column: targetCol };
            return {
                ...prev,
                [currentCol]: currentList.filter(t => t.id !== taskId),
                [targetCol]: [...(prev[targetCol] || []), movedTask]
            };
        });

        try {
            await fetch(`/api/v1/projects/tasks/${taskId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ column: targetCol })
            });
        } catch (err) {
            console.warn('Task move warning:', err);
        }
    };
    const moveTask = moveTaskState;

    const advanceTask = (e, taskId, currentCol) => {
        e?.stopPropagation?.();
        const nextIndex = columnOrder.indexOf(currentCol) + 1;
        if (nextIndex < columnOrder.length) {
            moveTaskState(taskId, currentCol, columnOrder[nextIndex]);
        }
    };

    const rollbackTask = (e, taskId, currentCol) => {
        e?.stopPropagation?.();
        const prevIndex = columnOrder.indexOf(currentCol) - 1;
        if (prevIndex >= 0) {
            moveTaskState(taskId, currentCol, columnOrder[prevIndex]);
        }
    };

    return (
        <div className={styles.projectContainer}>

            {/* HEADER */}
            <div className={styles.headerRow}>
                <div className={styles.titleBlock}>
                    <h2>{readData("components.Workspace.ProjectView", "ProjectView_text_4")}</h2>
                    <p>{readData("components.Workspace.ProjectView", "ProjectView_text_5")}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <button
                        className={styles.btnPrimary}
                        onClick={() => setFilterMyTasks(prev => !prev)}
                        style={{
                            background: filterMyTasks ? 'var(--signal, #0F6E5C)' : 'var(--surface, #FFFFFF)',
                            color: filterMyTasks ? '#FFFFFF' : 'var(--ink, #10222F)',
                            border: `1px solid ${filterMyTasks ? 'var(--signal, #0F6E5C)' : 'var(--rule, #D8DEDA)'}`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            padding: '0.65rem 1.1rem'
                        }}
                    >
                        <Filter size={15} />
                        {filterMyTasks ? readData("components.Workspace.ProjectView", "display_8") : readData("components.Workspace.ProjectView", "display_9")}
                    </button>
                    <button
                        className={styles.btnPrimary}
                        onClick={() => {
                            setTaskProject(activeProject?.title || readData("components.Workspace.ProjectView", "fallback_7"));
                            setIsAssignModalOpen(true);
                        }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            padding: '0.65rem 1.25rem',
                            boxShadow: '0 4px 14px rgba(15, 110, 92, 0.25)'
                        }}
                    >
                        <Plus size={18} />{readData("components.Workspace.ProjectView", "ProjectView_text_6")}</button>
                    <button
                        className={styles.btnPrimary}
                        onClick={() => setIsCreateProjectModalOpen(true)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            padding: '0.65rem 1.25rem',
                            background: '#1B6CA8',
                            boxShadow: '0 4px 14px rgba(27, 108, 168, 0.25)'
                        }}
                    >
                        <Plus size={18} />{readData("components.Workspace.ProjectView", "ProjectView_text_7")}</button>
                </div>
            </div>

            <div className={styles.mainLayout}>

                {/* PROJECT OVERVIEW CARDS */}
                <div className={styles.projectGrid}>
                    {visibleProjects.map(proj => {
                        const isActive = proj.id === activeProject?.id;
                        // Count tasks assigned to current user in this project
                        const myTasksCount = Object.values(kanbanTasks).reduce((acc, col) =>
                            acc + col.filter(t =>
                                (t.project === proj.title || t.project === proj.id) &&
                                ((t.assignee || '').toLowerCase().includes(activeUserName) || activeUserName.includes((t.assignee || '').toLowerCase()))
                            ).length
                        , 0);

                        return (
                            <div
                                key={proj.id}
                                className={styles.projectCard}
                                onClick={() => setSelectedProjectId(proj.id)}
                                style={{
                                    border: isActive ? `2px solid ${proj.color || '#2DD4A8'}` : '1px solid var(--rule, #D8DEDA)',
                                    boxShadow: isActive ? `0 0 20px ${proj.color || '#2DD4A8'}33` : 'none',
                                    position: 'relative',
                                    cursor: 'pointer'
                                }}
                            >
                                <div className={styles.projHeader}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div className={styles.projTitle}>{proj.title}</div>
                                        {isActive && (
                                            <span style={{
                                                background: 'rgba(45, 212, 168, 0.15)',
                                                color: '#2DD4A8',
                                                fontSize: '0.68rem',
                                                fontWeight: 800,
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                textTransform: 'uppercase'
                                            }}>{readData("components.Workspace.ProjectView", "ProjectView_text_8")}</span>
                                        )}
                                    </div>
                                    <span style={{
                                        fontSize: '0.7rem',
                                        color: 'var(--text-2)',
                                        background: 'var(--card-2)',
                                        padding: '2px 6px',
                                        borderRadius: '4px'
                                    }}>
                                        {proj.visibility === 'all' ? readData("components.Workspace.ProjectView", "display_10") : readData("components.Workspace.ProjectView", "display_11")}
                                    </span>
                                </div>
                                <div className={styles.projDesc}>{proj.desc}</div>
                                <div className={styles.progressWrapper}>
                                    <div
                                        className={styles.progressBar}
                                        style={{ width: `${proj.progress || 25}%`, background: proj.color || '#2DD4A8' }}
                                    ></div>
                                </div>
                                <div className={styles.projMeta}>
                                    <div className={styles.projMembers}>
                                        {(proj.members || readData("components.Workspace.ProjectView", "ProjectView_9")).slice(0, 3).map((m, idx) => (
                                            <NextImage unoptimized width={48} height={48} alt=""
                                                key={idx}
                                                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(m)}&background=random`}
                                                className={styles.memberAvatar}
                                                title={m}
                                            />
                                        ))}
                                        {(proj.members || []).length > 3 && (
                                            <span style={{ fontSize: '0.72rem', marginLeft: '4px', alignSelf: 'center', color: 'var(--text-2)' }}>{readData("components.Workspace.ProjectView", "ProjectView_text_10")}{proj.members.length - 3}
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {myTasksCount > 0 && (
                                            <span style={{
                                                fontSize: '0.68rem',
                                                background: 'rgba(59, 130, 246, 0.15)',
                                                color: '#60a5fa',
                                                padding: '2px 6px',
                                                borderRadius: 4,
                                                fontWeight: 700
                                            }}>
                                                {myTasksCount}{readData("components.Workspace.ProjectView", "ProjectView_text_11")}</span>
                                        )}
                                        <span>{readData("components.Workspace.ProjectView", "ProjectView_text_12")}{proj.due}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Create New Project Dashed Card */}
                    <div
                        className={styles.projectCard}
                        onClick={() => setIsCreateProjectModalOpen(true)}
                        style={{
                            borderStyle: 'dashed',
                            borderColor: '#475569',
                            boxShadow: 'none',
                            background: 'rgba(255, 255, 255, 0.02)',
                            justifyContent: 'center',
                            alignItems: 'center',
                            cursor: 'pointer',
                            minHeight: '160px'
                        }}
                    >
                        <Plus size={32} color="#94a3b8" />
                        <span style={{ color: 'var(--text-2)', fontWeight: '600', marginTop: '0.5rem' }}>{readData("components.Workspace.ProjectView", "ProjectView_text_13")}</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>{readData("components.Workspace.ProjectView", "ProjectView_text_14")}</span>
                    </div>
                </div>

                {/* KANBAN BOARD */}
                <div className={styles.kanbanSection}>
                    <div className={styles.sectionTitle} style={{ justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Briefcase size={20} color={activeProject?.color || readData("components.Workspace.ProjectView", "fallback_8")} />
                            <span>{readData("components.Workspace.ProjectView", "ProjectView_text_15")}{activeProject?.title || readData("components.Workspace.ProjectView", "fallback_9")}{readData("components.Workspace.ProjectView", "ProjectView_text_16")}</span>
                            <span style={{
                                fontSize: '0.74rem',
                                color: 'var(--text-2)',
                                fontWeight: 500,
                                background: 'var(--card-2)',
                                padding: '3px 8px',
                                borderRadius: 12
                            }}>
                                {activeProject?.visibility === 'all' ? readData("components.Workspace.ProjectView", "display_12") : readData("components.Workspace.ProjectView", "display_13")}
                            </span>
                        </div>
                        <button
                            onClick={() => {
                                setTaskProject(activeProject?.title || readData("components.Workspace.ProjectView", "fallback_10"));
                                setIsAssignModalOpen(true);
                            }}
                            style={{
                                background: 'transparent',
                                border: '1px solid rgba(45, 212, 168, 0.4)',
                                color: '#2DD4A8',
                                borderRadius: 6,
                                padding: '0.35rem 0.75rem',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem'
                            }}
                        >
                            <Plus size={14} />{readData("components.Workspace.ProjectView", "ProjectView_text_17")}{activeProject?.title}
                        </button>
                    </div>

                    <div className={styles.kanbanBoard}>

                        {/* COLUMN: TO DO */}
                        <div className={styles.kanbanColumn}>
                            <div className={styles.colHeader}>
                                <span className={styles.colTitle}>{readData("components.Workspace.ProjectView", "ProjectView_text_18")}</span>
                                <span className={styles.colCount}>{displayTasks.todo.length}</span>
                            </div>
                            {displayTasks.todo.map(task => {
                                const isAssignedToMe = (task.assignee || '').toLowerCase().includes(activeUserName) ||
                                    activeUserName.includes((task.assignee || '').toLowerCase());

                                return (
                                    <div
                                        key={task.id}
                                        className={styles.taskCard}
                                        onClick={() => moveTask(task.id, 'todo', 'inprogress')}
                                        style={{
                                            cursor: 'pointer',
                                            border: isAssignedToMe ? '1px solid rgba(45, 212, 168, 0.5)' : undefined,
                                            background: isAssignedToMe ? 'rgba(45, 212, 168, 0.03)' : undefined
                                        }}
                                    >
                                        <div className={styles.taskTags}>
                                            <span className={`${styles.tag} ${styles.tagResearch}`}>{task.tag}</span>
                                            {task.priority && (
                                                <span className={`${styles.tag} ${task.priority === 'High' || task.priority === 'Urgent' ? styles.tagHigh : styles.tagDev}`}>
                                                    {task.priority}
                                                </span>
                                            )}
                                            {isAssignedToMe && (
                                                <span style={{ fontSize: '0.68rem', background: 'rgba(45, 212, 168, 0.15)', color: '#2DD4A8', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>{readData("components.Workspace.ProjectView", "ProjectView_text_19")}</span>
                                            )}
                                        </div>
                                        <div className={styles.taskTitle}>{task.title}</div>
                                        <div className={styles.taskFooter}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                <NextImage unoptimized width={48} height={48} alt="" src={`https://ui-avatars.com/api/?name=${encodeURIComponent(task.assignee)}&background=random`} className={styles.taskAssignee} />
                                                <span style={{ fontSize: '0.72rem', color: 'var(--slate, #5A6B78)', fontWeight: 600 }}>{task.assignee}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div className={styles.taskDue}><Clock size={12} /> {task.due || readData("components.Workspace.ProjectView", "fallback_11")}</div>
                                                <button
                                                    onClick={(e) => advanceTask(e, task.id, 'todo')}
                                                    style={{
                                                        background: 'rgba(59, 130, 246, 0.12)',
                                                        border: '1px solid rgba(59, 130, 246, 0.3)',
                                                        borderRadius: '4px',
                                                        color: '#60a5fa',
                                                        fontSize: '0.68rem',
                                                        fontWeight: 700,
                                                        padding: '2px 6px',
                                                        cursor: 'pointer'
                                                    }}
                                                    title={readData("components.Workspace.ProjectView", "ProjectView_title_20")}
                                                >{readData("components.Workspace.ProjectView", "ProjectView_text_21")}</button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {displayTasks.todo.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-2)', fontSize: '0.8rem' }}>{readData("components.Workspace.ProjectView", "ProjectView_text_22")}</div>
                            )}
                        </div>

                        {/* COLUMN: IN PROGRESS */}
                        <div className={styles.kanbanColumn}>
                            <div className={styles.colHeader}>
                                <span className={styles.colTitle}>{readData("components.Workspace.ProjectView", "ProjectView_text_23")}</span>
                                <span className={styles.colCount}>{displayTasks.inprogress.length}</span>
                            </div>
                            {displayTasks.inprogress.map(task => {
                                const isAssignedToMe = (task.assignee || '').toLowerCase().includes(activeUserName) ||
                                    activeUserName.includes((task.assignee || '').toLowerCase());

                                return (
                                    <div
                                        key={task.id}
                                        className={styles.taskCard}
                                        style={{
                                            borderLeft: '4px solid #3b82f6',
                                            cursor: 'pointer',
                                            border: isAssignedToMe ? '1px solid rgba(45, 212, 168, 0.5)' : undefined,
                                            borderLeftWidth: '4px',
                                            borderLeftColor: '#3b82f6',
                                            background: isAssignedToMe ? 'rgba(45, 212, 168, 0.03)' : undefined
                                        }}
                                        onClick={() => moveTask(task.id, 'inprogress', 'review')}
                                    >
                                        <div className={styles.taskTags}>
                                            <span className={`${styles.tag} ${styles.tagDev}`}>{task.tag}</span>
                                            {task.priority && (
                                                <span className={`${styles.tag} ${task.priority === 'High' || task.priority === 'Urgent' ? styles.tagHigh : styles.tagDev}`}>
                                                    {task.priority}
                                                </span>
                                            )}
                                            {isAssignedToMe && (
                                                <span style={{ fontSize: '0.68rem', background: 'rgba(45, 212, 168, 0.15)', color: '#2DD4A8', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>{readData("components.Workspace.ProjectView", "ProjectView_text_24")}</span>
                                            )}
                                        </div>
                                        <div className={styles.taskTitle}>{task.title}</div>
                                        <div className={styles.taskFooter}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                <NextImage unoptimized width={48} height={48} alt="" src={`https://ui-avatars.com/api/?name=${encodeURIComponent(task.assignee)}&background=random`} className={styles.taskAssignee} />
                                                <span style={{ fontSize: '0.72rem', color: 'var(--slate, #5A6B78)', fontWeight: 600 }}>{task.assignee}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                <button
                                                    onClick={(e) => rollbackTask(e, task.id, 'inprogress')}
                                                    style={{
                                                        background: 'var(--card-2)',
                                                        border: '1px solid rgba(255,255,255,0.15)',
                                                        borderRadius: '4px',
                                                        color: 'var(--text-2)',
                                                        fontSize: '0.65rem',
                                                        fontWeight: 600,
                                                        padding: '2px 5px',
                                                        cursor: 'pointer'
                                                    }}
                                                    title={readData("components.Workspace.ProjectView", "ProjectView_title_25")}
                                                >{readData("components.Workspace.ProjectView", "ProjectView_text_26")}</button>
                                                <button
                                                    onClick={(e) => advanceTask(e, task.id, 'inprogress')}
                                                    style={{
                                                        background: 'rgba(59, 130, 246, 0.12)',
                                                        border: '1px solid rgba(59, 130, 246, 0.3)',
                                                        borderRadius: '4px',
                                                        color: '#60a5fa',
                                                        fontSize: '0.68rem',
                                                        fontWeight: 700,
                                                        padding: '2px 6px',
                                                        cursor: 'pointer'
                                                    }}
                                                    title={readData("components.Workspace.ProjectView", "ProjectView_title_27")}
                                                >{readData("components.Workspace.ProjectView", "ProjectView_text_28")}</button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {displayTasks.inprogress.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-2)', fontSize: '0.8rem' }}>{readData("components.Workspace.ProjectView", "ProjectView_text_29")}</div>
                            )}
                        </div>

                        {/* COLUMN: REVIEW */}
                        <div className={styles.kanbanColumn}>
                            <div className={styles.colHeader}>
                                <span className={styles.colTitle}>{readData("components.Workspace.ProjectView", "ProjectView_text_30")}</span>
                                <span className={styles.colCount}>{displayTasks.review.length}</span>
                            </div>
                            {displayTasks.review.map(task => {
                                const isAssignedToMe = (task.assignee || '').toLowerCase().includes(activeUserName) ||
                                    activeUserName.includes((task.assignee || '').toLowerCase());

                                return (
                                    <div
                                        key={task.id}
                                        className={styles.taskCard}
                                        onClick={() => moveTask(task.id, 'review', 'done')}
                                        style={{
                                            cursor: 'pointer',
                                            border: isAssignedToMe ? '1px solid rgba(45, 212, 168, 0.5)' : undefined,
                                            background: isAssignedToMe ? 'rgba(45, 212, 168, 0.03)' : undefined
                                        }}
                                    >
                                        <div className={styles.taskTags}>
                                            <span className={`${styles.tag} ${styles.tagDev}`}>{task.tag}</span>
                                            {isAssignedToMe && (
                                                <span style={{ fontSize: '0.68rem', background: 'rgba(45, 212, 168, 0.15)', color: '#2DD4A8', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>{readData("components.Workspace.ProjectView", "ProjectView_text_31")}</span>
                                            )}
                                        </div>
                                        <div className={styles.taskTitle}>{task.title}</div>
                                        <div className={styles.taskFooter}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                <NextImage unoptimized width={48} height={48} alt="" src={`https://ui-avatars.com/api/?name=${encodeURIComponent(task.assignee)}&background=random`} className={styles.taskAssignee} />
                                                <span style={{ fontSize: '0.72rem', color: 'var(--slate, #5A6B78)', fontWeight: 600 }}>{task.assignee}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                <button
                                                    onClick={(e) => rollbackTask(e, task.id, 'review')}
                                                    style={{
                                                        background: 'var(--card-2)',
                                                        border: '1px solid rgba(255,255,255,0.15)',
                                                        borderRadius: '4px',
                                                        color: 'var(--text-2)',
                                                        fontSize: '0.65rem',
                                                        fontWeight: 600,
                                                        padding: '2px 5px',
                                                        cursor: 'pointer'
                                                    }}
                                                    title={readData("components.Workspace.ProjectView", "ProjectView_title_32")}
                                                >{readData("components.Workspace.ProjectView", "ProjectView_text_33")}</button>
                                                <button
                                                    onClick={(e) => advanceTask(e, task.id, 'review')}
                                                    style={{
                                                        background: 'rgba(34, 197, 94, 0.12)',
                                                        border: '1px solid rgba(34, 197, 94, 0.3)',
                                                        borderRadius: '4px',
                                                        color: '#4ade80',
                                                        fontSize: '0.68rem',
                                                        fontWeight: 700,
                                                        padding: '2px 6px',
                                                        cursor: 'pointer'
                                                    }}
                                                    title={readData("components.Workspace.ProjectView", "ProjectView_title_34")}
                                                >{readData("components.Workspace.ProjectView", "ProjectView_text_35")}</button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {displayTasks.review.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-2)', fontSize: '0.8rem' }}>{readData("components.Workspace.ProjectView", "ProjectView_text_36")}</div>
                            )}
                        </div>

                        {/* COLUMN: DONE */}
                        <div className={styles.kanbanColumn}>
                            <div className={styles.colHeader}>
                                <span className={styles.colTitle}>{readData("components.Workspace.ProjectView", "ProjectView_text_37")}</span>
                                <span className={styles.colCount}>{displayTasks.done.length}</span>
                            </div>
                            {displayTasks.done.map(task => {
                                const isAssignedToMe = (task.assignee || '').toLowerCase().includes(activeUserName) ||
                                    activeUserName.includes((task.assignee || '').toLowerCase());

                                return (
                                    <div
                                        key={task.id}
                                        className={styles.taskCard}
                                        style={{
                                            opacity: 0.85,
                                            border: isAssignedToMe ? '1px solid rgba(45, 212, 168, 0.5)' : undefined
                                        }}
                                    >
                                        <div className={styles.taskTags}>
                                            <span className={`${styles.tag} ${styles.tagResearch}`}>{task.tag}</span>
                                            {isAssignedToMe && (
                                                <span style={{ fontSize: '0.68rem', background: 'rgba(45, 212, 168, 0.15)', color: '#2DD4A8', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>{readData("components.Workspace.ProjectView", "ProjectView_text_38")}</span>
                                            )}
                                        </div>
                                        <div className={styles.taskTitle} style={{ textDecoration: 'line-through', color: 'var(--text-2)' }}>{task.title}</div>
                                        <div className={styles.taskFooter}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                <NextImage unoptimized width={48} height={48} alt="" src={`https://ui-avatars.com/api/?name=${encodeURIComponent(task.assignee)}&background=random`} className={styles.taskAssignee} />
                                                <span style={{ fontSize: '0.72rem', color: 'var(--slate, #5A6B78)', fontWeight: 600 }}>{task.assignee}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                <span style={{ color: '#05CD99', fontSize: '0.7rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                    <CheckCircle size={12} />{readData("components.Workspace.ProjectView", "ProjectView_text_39")}</span>
                                                <button
                                                    onClick={(e) => rollbackTask(e, task.id, 'done')}
                                                    style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        color: 'var(--text-2)',
                                                        fontSize: '0.65rem',
                                                        textDecoration: 'underline',
                                                        cursor: 'pointer',
                                                        padding: '0 2px'
                                                    }}
                                                    title={readData("components.Workspace.ProjectView", "ProjectView_title_40")}
                                                >{readData("components.Workspace.ProjectView", "ProjectView_text_41")}</button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {displayTasks.done.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-2)', fontSize: '0.8rem' }}>{readData("components.Workspace.ProjectView", "ProjectView_text_42")}</div>
                            )}
                        </div>

                    </div>
                </div>

            </div>

            {/* ASSIGN TASK MODAL */}
            {isAssignModalOpen && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'var(--overlay)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    padding: '1.25rem'
                }} onClick={() => setIsAssignModalOpen(false)}>
                    <div
                        style={{
                            background: 'var(--card)',
                            border: '1px solid rgba(45, 212, 168, 0.3)',
                            borderRadius: '16px',
                            width: '100%',
                            maxWidth: '520px',
                            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.7)',
                            padding: '1.75rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1.25rem'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <UserCheck size={20} color="#2DD4A8" />{readData("components.Workspace.ProjectView", "ProjectView_text_43")}</h3>
                                <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: 'var(--text-2)' }}>{readData("components.Workspace.ProjectView", "ProjectView_text_44")}</p>
                            </div>
                            <button
                                onClick={() => setIsAssignModalOpen(false)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-2)', cursor: 'pointer', padding: 4 }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateTask} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {/* Title */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' }}>{readData("components.Workspace.ProjectView", "ProjectView_text_45")}</label>
                                <input
                                    type="text"
                                    placeholder={readData("components.Workspace.ProjectView", "ProjectView_placeholder_46")}
                                    value={taskTitle}
                                    onChange={e => setTaskTitle(e.target.value)}
                                    required
                                    style={{
                                        background: 'var(--card-2)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: 8,
                                        padding: '0.65rem 0.85rem',
                                        color: 'var(--text)',
                                        fontSize: '0.84rem',
                                        outline: 'none'
                                    }}
                                />
                            </div>

                            {/* Project & Tag */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' }}>{readData("components.Workspace.ProjectView", "ProjectView_text_47")}</label>
                                    <select
                                        value={taskProject}
                                        onChange={e => setTaskProject(e.target.value)}
                                        style={{
                                            background: 'var(--card-2)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            borderRadius: 8,
                                            padding: '0.65rem 0.85rem',
                                            color: 'var(--text)',
                                            fontSize: '0.84rem',
                                            outline: 'none',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <option value="Website Redesign">{readData("components.Workspace.ProjectView", "ProjectView_text_48")}</option>
                                        <option value="Mobile App Launch">{readData("components.Workspace.ProjectView", "ProjectView_text_49")}</option>
                                        <option value="Core HRMS Platform">{readData("components.Workspace.ProjectView", "ProjectView_text_50")}</option>
                                        <option value="Statutory Automation">{readData("components.Workspace.ProjectView", "ProjectView_text_51")}</option>
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' }}>{readData("components.Workspace.ProjectView", "ProjectView_text_52")}</label>
                                    <select
                                        value={taskTag}
                                        onChange={e => setTaskTag(e.target.value)}
                                        style={{
                                            background: 'var(--card-2)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            borderRadius: 8,
                                            padding: '0.65rem 0.85rem',
                                            color: 'var(--text)',
                                            fontSize: '0.84rem',
                                            outline: 'none',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <option value="Dev">{readData("components.Workspace.ProjectView", "ProjectView_text_53")}</option>
                                        <option value="Design">{readData("components.Workspace.ProjectView", "ProjectView_text_54")}</option>
                                        <option value="Research">{readData("components.Workspace.ProjectView", "ProjectView_text_55")}</option>
                                        <option value="Security">{readData("components.Workspace.ProjectView", "ProjectView_text_56")}</option>
                                        <option value="Operations">{readData("components.Workspace.ProjectView", "ProjectView_text_57")}</option>
                                    </select>
                                </div>
                            </div>

                            {/* Assignee & Priority */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' }}>{readData("components.Workspace.ProjectView", "ProjectView_text_58")}</label>
                                    <select
                                        value={taskAssignee}
                                        onChange={e => setTaskAssignee(e.target.value)}
                                        style={{
                                            background: 'var(--card-2)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            borderRadius: 8,
                                            padding: '0.65rem 0.85rem',
                                            color: 'var(--text)',
                                            fontSize: '0.84rem',
                                            outline: 'none',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {employees.length > 0 ? (
                                            employees.map(emp => (
                                                <option key={emp.id} value={emp.name}>
                                                    {emp.name}{readData("components.Workspace.ProjectView", "ProjectView_text_59")}{emp.role}{readData("components.Workspace.ProjectView", "ProjectView_text_60")}{emp.dept}{readData("components.Workspace.ProjectView", "ProjectView_text_61")}</option>
                                            ))
                                        ) : (
                                            <>
                                                <option value="Priya Nair">{readData("components.Workspace.ProjectView", "ProjectView_text_62")}</option>
                                                <option value="Trisha Khanna">{readData("components.Workspace.ProjectView", "ProjectView_text_63")}</option>
                                                <option value="Rahul Sharma">{readData("components.Workspace.ProjectView", "ProjectView_text_64")}</option>
                                                <option value="David Miller">{readData("components.Workspace.ProjectView", "ProjectView_text_65")}</option>
                                                <option value="Sarah Chen">{readData("components.Workspace.ProjectView", "ProjectView_text_66")}</option>
                                                <option value="Amit Verma">{readData("components.Workspace.ProjectView", "ProjectView_text_67")}</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' }}>{readData("components.Workspace.ProjectView", "ProjectView_text_68")}</label>
                                    <select
                                        value={taskPriority}
                                        onChange={e => setTaskPriority(e.target.value)}
                                        style={{
                                            background: 'var(--card-2)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            borderRadius: 8,
                                            padding: '0.65rem 0.85rem',
                                            color: 'var(--text)',
                                            fontSize: '0.84rem',
                                            outline: 'none',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <option value="Urgent">{readData("components.Workspace.ProjectView", "ProjectView_text_69")}</option>
                                        <option value="High">{readData("components.Workspace.ProjectView", "ProjectView_text_70")}</option>
                                        <option value="Medium">{readData("components.Workspace.ProjectView", "ProjectView_text_71")}</option>
                                        <option value="Low">{readData("components.Workspace.ProjectView", "ProjectView_text_72")}</option>
                                    </select>
                                </div>
                            </div>

                            {/* Due Date & Assignment Governance info */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' }}>{readData("components.Workspace.ProjectView", "ProjectView_text_73")}</label>
                                <input
                                    type="text"
                                    placeholder={readData("components.Workspace.ProjectView", "ProjectView_placeholder_74")}
                                    value={taskDue}
                                    onChange={e => setTaskDue(e.target.value)}
                                    style={{
                                        background: 'var(--card-2)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: 8,
                                        padding: '0.65rem 0.85rem',
                                        color: 'var(--text)',
                                        fontSize: '0.84rem',
                                        outline: 'none'
                                    }}
                                />
                            </div>

                            <div style={{
                                background: 'rgba(45, 212, 168, 0.08)',
                                border: '1px solid rgba(45, 212, 168, 0.25)',
                                borderRadius: 8,
                                padding: '0.65rem 0.85rem',
                                fontSize: '0.76rem',
                                color: 'var(--text-2)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}>
                                <Sparkles size={16} color="#2DD4A8" style={{ flexShrink: 0 }} />
                                <span>
                                    <strong>{readData("components.Workspace.ProjectView", "ProjectView_text_75")}</strong>{readData("components.Workspace.ProjectView", "ProjectView_text_76")}</span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.5rem' }}>
                                <button
                                    type="button"
                                    className={styles.btnPrimary}
                                    onClick={() => setIsAssignModalOpen(false)}
                                    style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#CBD5E1' }}
                                >{readData("components.Workspace.ProjectView", "ProjectView_text_77")}</button>
                                <button
                                    type="submit"
                                    className={styles.btnPrimary}
                                    style={{
                                        background: '#0F6E5C',
                                        color: '#FFFFFF'
                                    }}
                                >{readData("components.Workspace.ProjectView", "ProjectView_text_78")}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* CREATE PROJECT MODAL */}
            {isCreateProjectModalOpen && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'var(--overlay)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    padding: '1.25rem'
                }} onClick={() => setIsCreateProjectModalOpen(false)}>
                    <div
                        style={{
                            background: 'var(--card)',
                            border: '1px solid rgba(45, 212, 168, 0.3)',
                            borderRadius: '16px',
                            width: '100%',
                            maxWidth: '540px',
                            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.7)',
                            padding: '1.75rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1.25rem'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Briefcase size={20} color="#2DD4A8" />{readData("components.Workspace.ProjectView", "ProjectView_text_79")}</h3>
                                <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: 'var(--text-2)' }}>{readData("components.Workspace.ProjectView", "ProjectView_text_80")}</p>
                            </div>
                            <button
                                onClick={() => setIsCreateProjectModalOpen(false)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-2)', cursor: 'pointer', padding: 4 }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateProject} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {/* Title */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' }}>{readData("components.Workspace.ProjectView", "ProjectView_text_81")}</label>
                                <input
                                    type="text"
                                    placeholder={readData("components.Workspace.ProjectView", "ProjectView_placeholder_82")}
                                    value={newProjTitle}
                                    onChange={e => setNewProjTitle(e.target.value)}
                                    required
                                    style={{
                                        background: 'var(--card-2)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: 8,
                                        padding: '0.65rem 0.85rem',
                                        color: 'var(--text)',
                                        fontSize: '0.84rem',
                                        outline: 'none'
                                    }}
                                />
                            </div>

                            {/* Description */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' }}>{readData("components.Workspace.ProjectView", "ProjectView_text_83")}</label>
                                <textarea
                                    rows={2}
                                    placeholder={readData("components.Workspace.ProjectView", "ProjectView_placeholder_84")}
                                    value={newProjDesc}
                                    onChange={e => setNewProjDesc(e.target.value)}
                                    style={{
                                        background: 'var(--card-2)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: 8,
                                        padding: '0.65rem 0.85rem',
                                        color: 'var(--text)',
                                        fontSize: '0.84rem',
                                        outline: 'none',
                                        resize: 'none',
                                        fontFamily: 'inherit'
                                    }}
                                />
                            </div>

                            {/* Due Date & Color */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' }}>{readData("components.Workspace.ProjectView", "ProjectView_text_85")}</label>
                                    <input
                                        type="text"
                                        placeholder={readData("components.Workspace.ProjectView", "ProjectView_placeholder_86")}
                                        value={newProjDue}
                                        onChange={e => setNewProjDue(e.target.value)}
                                        style={{
                                            background: 'var(--card-2)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            borderRadius: 8,
                                            padding: '0.65rem 0.85rem',
                                            color: 'var(--text)',
                                            fontSize: '0.84rem',
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' }}>{readData("components.Workspace.ProjectView", "ProjectView_text_87")}</label>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', height: '100%' }}>
                                        {readData("components.Workspace.ProjectView", "ProjectView_88").map(c => (
                                            <button
                                                key={c.color}
                                                type="button"
                                                onClick={() => setNewProjColor(c.color)}
                                                style={{
                                                    width: 28,
                                                    height: 28,
                                                    borderRadius: '50%',
                                                    background: c.color,
                                                    border: newProjColor === c.color ? '3px solid white' : '2px solid transparent',
                                                    cursor: 'pointer',
                                                    boxShadow: newProjColor === c.color ? `0 0 10px ${c.color}` : 'none'
                                                }}
                                                title={c.name}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Visibility & Access Control */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' }}>{readData("components.Workspace.ProjectView", "ProjectView_text_89")}</label>
                                <select
                                    value={newProjVisibility}
                                    onChange={e => setNewProjVisibility(e.target.value)}
                                    style={{
                                        background: 'var(--card-2)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: 8,
                                        padding: '0.65rem 0.85rem',
                                        color: 'var(--text)',
                                        fontSize: '0.84rem',
                                        outline: 'none',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <option value="team">{readData("components.Workspace.ProjectView", "ProjectView_text_90")}</option>
                                    <option value="all">{readData("components.Workspace.ProjectView", "ProjectView_text_91")}</option>
                                    <option value="private">{readData("components.Workspace.ProjectView", "ProjectView_text_92")}</option>
                                </select>
                            </div>

                            {/* Initial Pod Members */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase' }}>{readData("components.Workspace.ProjectView", "ProjectView_text_93")}</label>
                                <div style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '0.45rem',
                                    maxHeight: '90px',
                                    overflowY: 'auto',
                                    padding: '0.4rem',
                                    background: 'rgba(0,0,0,0.2)',
                                    borderRadius: 8,
                                    border: '1px solid rgba(255,255,255,0.08)'
                                }}>
                                    {(employees.length > 0 ? employees : readData("components.Workspace.ProjectView", "ProjectView_94")).map(emp => {
                                        const isSelected = newProjMembers.includes(emp.name);
                                        return (
                                            <button
                                                key={emp.id}
                                                type="button"
                                                onClick={() => {
                                                    setNewProjMembers(prev =>
                                                        isSelected ? prev.filter(m => m !== emp.name) : [...prev, emp.name]
                                                    );
                                                }}
                                                style={{
                                                    background: isSelected ? 'rgba(45, 212, 168, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                                    border: `1px solid ${isSelected ? '#2DD4A8' : 'rgba(255, 255, 255, 0.1)'}`,
                                                    color: isSelected ? '#2DD4A8' : '#94A3B8',
                                                    borderRadius: '6px',
                                                    padding: '3px 8px',
                                                    fontSize: '0.74rem',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.3rem'
                                                }}
                                            >
                                                {isSelected ? <Check size={12} /> : null}
                                                {emp.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Automatic Visibility Grant Banner */}
                            <div style={{
                                background: 'rgba(59, 130, 246, 0.08)',
                                border: '1px solid rgba(59, 130, 246, 0.25)',
                                borderRadius: 8,
                                padding: '0.65rem 0.85rem',
                                fontSize: '0.76rem',
                                color: '#93C5FD',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}>
                                <Sparkles size={16} color="#60A5FA" style={{ flexShrink: 0 }} />
                                <span>
                                    <strong>{readData("components.Workspace.ProjectView", "ProjectView_text_95")}</strong>{readData("components.Workspace.ProjectView", "ProjectView_text_96")}</span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.5rem' }}>
                                <button
                                    type="button"
                                    className={styles.btnPrimary}
                                    onClick={() => setIsCreateProjectModalOpen(false)}
                                    style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#CBD5E1' }}
                                >{readData("components.Workspace.ProjectView", "ProjectView_text_97")}</button>
                                <button
                                    type="submit"
                                    className={styles.btnPrimary}
                                    style={{
                                        background: '#1B6CA8',
                                        color: '#FFFFFF'
                                    }}
                                >{readData("components.Workspace.ProjectView", "ProjectView_text_98")}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectView;
