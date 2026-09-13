"use client";
import {useTranslation} from '@/context/I18nContext';

import { readData } from '../../services/workspace-data.mjs';

import React, { useState, useEffect } from 'react';
import {
    X, Workflow, Play, Plus, Trash2, Clock, CheckCircle2,
    AlertCircle, Sparkles, Send, Users, SlidersHorizontal,
    Layers, ArrowRight, ShieldCheck, Terminal, Save, RefreshCw
} from 'lucide-react';
import styles from './WorkflowBuilderModal.module.css';
import { useHRMS } from '@/context/HRMSContext';

const NODE_TYPE_CONFIG = {
    trigger: {
        ...readData("components.Clerio.WorkflowBuilderModal", "trigger_fields_1"),
        icon: Sparkles,
        ...readData("components.Clerio.WorkflowBuilderModal", "trigger_fields_2")
    },
    condition: {
        ...readData("components.Clerio.WorkflowBuilderModal", "condition_fields_3"),
        icon: SlidersHorizontal,
        ...readData("components.Clerio.WorkflowBuilderModal", "condition_fields_4")
    },
    approval: {
        ...readData("components.Clerio.WorkflowBuilderModal", "approval_fields_5"),
        icon: Users,
        ...readData("components.Clerio.WorkflowBuilderModal", "approval_fields_6")
    },
    action: {
        ...readData("components.Clerio.WorkflowBuilderModal", "action_fields_7"),
        icon: Workflow,
        ...readData("components.Clerio.WorkflowBuilderModal", "action_fields_8")
    },
    integration: {
        ...readData("components.Clerio.WorkflowBuilderModal", "integration_fields_9"),
        icon: Send,
        ...readData("components.Clerio.WorkflowBuilderModal", "integration_fields_10")
    }
};

const WorkflowBuilderModal = ({ isOpen, onClose }) => {
    const {t: translateText}=useTranslation();

    const {
        workflows = [],
        updateWorkflowNode,
        addWorkflowNode,
        deleteWorkflowNode,
        toggleWorkflowStatus,
        showToast
    } = useHRMS();

    const [activeWorkflowId, setActiveWorkflowId] = useState(readData("components.Clerio.WorkflowBuilderModal", "initialState_1"));
    const [selectedNodeId, setSelectedNodeId] = useState(null);
    const [isSimulating, setIsSimulating] = useState(false);
    const [simulatedNodeId, setSimulatedNodeId] = useState(null);
    const [simulationLogs, setSimulationLogs] = useState([]);

    // Active workflow object
    const activeWorkflow = workflows.find(w => w.id === activeWorkflowId) || workflows[0];

    // Local form state for selected node editing
    const selectedNode = activeWorkflow?.nodes?.find(n => n.id === selectedNodeId);
    const [nodeTitle, setNodeTitle] = useState('');
    const [nodeSubtitle, setNodeSubtitle] = useState('');
    const [nodeSLA, setNodeSLA] = useState('');

    useEffect(() => {
        if (selectedNode) {
            setNodeTitle(selectedNode.title || '');
            setNodeSubtitle(selectedNode.subtitle || '');
            setNodeSLA(selectedNode.sla || readData("components.Clerio.WorkflowBuilderModal", "fallback_1"));
        } else {
            setNodeTitle('');
            setNodeSubtitle('');
            setNodeSLA('');
        }
    }, [selectedNode]);

    if (!isOpen || !activeWorkflow) return null;

    const handleSaveNodeEdits = (e) => {
        e.preventDefault();
        if (!selectedNodeId) return;
        updateWorkflowNode(activeWorkflowId, selectedNodeId, {
            title: nodeTitle,
            subtitle: nodeSubtitle,
            sla: nodeSLA
        });
    };

    const handleAddStep = (type) => {
        const typeInfo = NODE_TYPE_CONFIG[type] || NODE_TYPE_CONFIG.action;
        const newStep = {
            type,
            title: `${typeInfo.label}: New Step`,
            subtitle: `Automated handler for ${type}`,
            sla: type === 'approval' ? '24 Hours SLA' : undefined,
            ...readData("components.Clerio.WorkflowBuilderModal", "newStep_fields_11")
        };
        addWorkflowNode(activeWorkflowId, newStep);
    };

    // Real-time step-by-step execution simulation
    const handleRunSimulation = () => {
        if (!activeWorkflow?.nodes?.length || isSimulating) return;

        setIsSimulating(true);
        setSelectedNodeId(null);
        setSimulationLogs([]);

        const startTime = new Date().toLocaleTimeString();
        const initialLog = `[${startTime}] ⚡ Starting live simulation: "${activeWorkflow.name}"`;
        setSimulationLogs([initialLog]);

        const nodes = activeWorkflow.nodes;
        let stepIdx = 0;

        const interval = setInterval(() => {
            if (stepIdx < nodes.length) {
                const node = nodes[stepIdx];
                setSimulatedNodeId(node.id);

                const timeStr = new Date().toLocaleTimeString();
                let logMsg = '';

                if (node.type === 'trigger') {
                    logMsg = `[${timeStr}] ⚡ TRIGGER FIRED: ${node.title} -> payload validated.`;
                } else if (node.type === 'condition') {
                    logMsg = `[${timeStr}] 🔍 CONDITION EVALUATED: [PASS] Criteria matched.`;
                } else if (node.type === 'approval') {
                    logMsg = `[${timeStr}] 👥 APPROVAL REQUEST DISPATCHED: SLA ${node.sla || readData("components.Clerio.WorkflowBuilderModal", "fallback_2")} initialized.`;
                } else if (node.type === 'action') {
                    logMsg = `[${timeStr}] ⚙️ AUTOMATED ACTION EXECUTED: Zero-Trust IAM & payroll sync complete.`;
                } else {
                    logMsg = `[${timeStr}] 📢 WEBHOOK DISPATCHED: Team notification sent via Slack.`;
                }

                setSimulationLogs(prev => [...prev, logMsg]);
                stepIdx++;
            } else {
                clearInterval(interval);
                setIsSimulating(false);
                setSimulatedNodeId(null);
                const finishTime = new Date().toLocaleTimeString();
                setSimulationLogs(prev => [
                    ...prev,
                    `[${finishTime}] ✅ WORKFLOW EXECUTION COMPLETED: All ${nodes.length} stages passed successfully.`
                ]);
                showToast(translateText("components.Clerio.WorkflowBuilderModal","text_3c9b888d55"),translateText("components.Clerio.WorkflowBuilderModal","text_09ac4f4b73", {value1: String(activeWorkflow.name), value2: String(nodes.length)}),
                    'success'
                );
            }
        }, 800);
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className={styles.header}>
                    <div className={styles.headerLeft}>
                        <div className={styles.headerIcon}>
                            <Workflow size={24} />
                        </div>
                        <div>
                            <h3>{readData("components.Clerio.WorkflowBuilderModal", "WorkflowBuilderModal_text_13")}</h3>
                            <p>{readData("components.Clerio.WorkflowBuilderModal", "WorkflowBuilderModal_text_14")}</p>
                        </div>
                    </div>

                    <div className={styles.headerActions}>
                        <button
                            className={styles.btnSimulate}
                            onClick={handleRunSimulation}
                            disabled={isSimulating}
                        >
                            <Play size={15} /> {isSimulating ? readData("components.Clerio.WorkflowBuilderModal", "display_2") : readData("components.Clerio.WorkflowBuilderModal", "display_3")}
                        </button>
                        <button
                            className={styles.btnSecondary}
                            onClick={() => toggleWorkflowStatus(activeWorkflow.id)}
                        >{readData("components.Clerio.WorkflowBuilderModal", "WorkflowBuilderModal_text_15")}<strong style={{ color: activeWorkflow.status === 'Active' ? '#16a34a' : '#64748b' }}>{activeWorkflow.status}</strong>
                        </button>
                        <button className={styles.closeBtn} onClick={onClose} title={readData("components.Clerio.WorkflowBuilderModal", "WorkflowBuilderModal_title_16")}>
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Workflow Selector Tab Bar */}
                <div className={styles.workflowTabs}>
                    {workflows.map(wf => (
                        <button
                            key={wf.id}
                            className={`${styles.wfTabBtn} ${activeWorkflowId === wf.id ? styles.active : ''}`}
                            onClick={() => {
                                setActiveWorkflowId(wf.id);
                                setSelectedNodeId(null);
                            }}
                        >
                            <span>{wf.name}</span>
                            <span className={wf.status === 'Active' ? styles.statusBadgeActive : styles.statusBadgeDraft}>
                                {wf.status}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Main Split-Pane Workspace */}
                <div className={styles.workspace}>
                    {/* Left Canvas: Flowchart Graph */}
                    <div className={styles.canvasArea}>
                        <div className={styles.workflowMetaCard}>
                            <div>
                                <h4>{activeWorkflow.name}</h4>
                                <p>{activeWorkflow.description}</p>
                            </div>
                            <span style={{ fontSize: '0.78rem', color: '#2563eb', background: '#eff6ff', padding: '0.25rem 0.6rem', borderRadius: '6px', fontWeight: 700 }}>
                                {activeWorkflow.category}
                            </span>
                        </div>

                        {/* Connected Node Flowchart */}
                        {activeWorkflow.nodes.map((node, index) => {
                            const conf = NODE_TYPE_CONFIG[node.type] || NODE_TYPE_CONFIG.action;
                            const IconComponent = conf.icon;
                            const isSelected = selectedNodeId === node.id;
                            const isBeingSimulated = simulatedNodeId === node.id;

                            return (
                                <div key={node.id} className={styles.nodeWrapper}>
                                    <div
                                        className={`${styles.nodeCard} ${isSelected ? styles.selected : ''} ${isBeingSimulated ? styles.activeSimulating : ''}`}
                                        onClick={() => setSelectedNodeId(node.id)}
                                    >
                                        <div className={styles.nodeLeft}>
                                            <div
                                                className={styles.nodeTypeIcon}
                                                style={{ background: conf.bg, color: conf.color }}
                                            >
                                                <IconComponent size={18} />
                                            </div>
                                            <div className={styles.nodeContent}>
                                                <h5>{node.title}</h5>
                                                <p>{node.subtitle}</p>
                                            </div>
                                        </div>

                                        <div className={styles.nodeRight}>
                                            <span
                                                className={styles.typeBadge}
                                                style={{ background: conf.badgeBg, color: conf.badgeColor }}
                                            >
                                                {conf.label}
                                            </span>
                                            {node.sla && (
                                                <span className={styles.slaBadge}>
                                                    <Clock size={11} /> {node.sla}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Connector Arrow down to next step */}
                                    {index < activeWorkflow.nodes.length - 1 && (
                                        <div className={styles.connectorLine} />
                                    )}
                                </div>
                            );
                        })}

                        {/* Append Step Quick Bar */}
                        <div className={styles.appendNodeBar}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b' }}>{readData("components.Clerio.WorkflowBuilderModal", "WorkflowBuilderModal_text_17")}</span>
                            <button className={styles.appendNodeBtn} onClick={() => handleAddStep('approval')}>
                                <Users size={13} color="#2563eb" />{readData("components.Clerio.WorkflowBuilderModal", "WorkflowBuilderModal_text_18")}</button>
                            <button className={styles.appendNodeBtn} onClick={() => handleAddStep('condition')}>
                                <SlidersHorizontal size={13} color="#d97706" />{readData("components.Clerio.WorkflowBuilderModal", "WorkflowBuilderModal_text_19")}</button>
                            <button className={styles.appendNodeBtn} onClick={() => handleAddStep('action')}>
                                <Workflow size={13} color="#16a34a" />{readData("components.Clerio.WorkflowBuilderModal", "WorkflowBuilderModal_text_20")}</button>
                            <button className={styles.appendNodeBtn} onClick={() => handleAddStep('integration')}>
                                <Send size={13} color="#db2777" />{readData("components.Clerio.WorkflowBuilderModal", "WorkflowBuilderModal_text_21")}</button>
                        </div>
                    </div>

                    {/* Right Inspector & Audit Pane */}
                    <div className={styles.inspectorPane}>
                        <div className={styles.inspectorHeader}>
                            <h4>
                                {isSimulating || simulationLogs.length > 0 ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#16a34a' }}>
                                        <Terminal size={16} />{readData("components.Clerio.WorkflowBuilderModal", "WorkflowBuilderModal_text_22")}</span>
                                ) : selectedNode ? (
                                    readData("components.Clerio.WorkflowBuilderModal", "display_4")
                                ) : (
                                    readData("components.Clerio.WorkflowBuilderModal", "display_5")
                                )}
                            </h4>
                            {simulationLogs.length > 0 && !isSimulating && (
                                <button
                                    onClick={() => setSimulationLogs([])}
                                    style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '0.76rem', cursor: 'pointer' }}
                                >{readData("components.Clerio.WorkflowBuilderModal", "WorkflowBuilderModal_text_23")}</button>
                            )}
                        </div>

                        {/* If simulating or logs exist, show live terminal */}
                        {simulationLogs.length > 0 ? (
                            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', height: '100%' }}>
                                <div className={styles.terminalCard}>
                                    {simulationLogs.map((log, i) => (
                                        <div key={i} className={styles.terminalLine}>
                                            <span className={log.includes('COMPLETED') ? styles.logSuccess : styles.logInfo}>
                                                {log}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ fontSize: '0.76rem', color: '#64748b', textAlign: 'center' }}>{readData("components.Clerio.WorkflowBuilderModal", "WorkflowBuilderModal_text_24")}</div>
                            </div>
                        ) : selectedNode ? (
                            <form className={styles.inspectorBody} onSubmit={handleSaveNodeEdits}>
                                <div className={styles.inputGroup}>
                                    <label className={styles.inputLabel}>{readData("components.Clerio.WorkflowBuilderModal", "WorkflowBuilderModal_text_25")}</label>
                                    <input
                                        className={styles.textInput}
                                        value={nodeTitle}
                                        onChange={(e) => setNodeTitle(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className={styles.inputGroup}>
                                    <label className={styles.inputLabel}>{readData("components.Clerio.WorkflowBuilderModal", "WorkflowBuilderModal_text_26")}</label>
                                    <input
                                        className={styles.textInput}
                                        value={nodeSubtitle}
                                        onChange={(e) => setNodeSubtitle(e.target.value)}
                                        placeholder={readData("components.Clerio.WorkflowBuilderModal", "WorkflowBuilderModal_placeholder_27")}
                                    />
                                </div>

                                {selectedNode.type === 'approval' && (
                                    <div className={styles.inputGroup}>
                                        <label className={styles.inputLabel}>{readData("components.Clerio.WorkflowBuilderModal", "WorkflowBuilderModal_text_28")}</label>
                                        <select
                                            className={styles.selectInput}
                                            value={nodeSLA}
                                            onChange={(e) => setNodeSLA(e.target.value)}
                                        >
                                            <option value="12 Hours SLA">{readData("components.Clerio.WorkflowBuilderModal", "WorkflowBuilderModal_text_29")}</option>
                                            <option value="24 Hours SLA">{readData("components.Clerio.WorkflowBuilderModal", "WorkflowBuilderModal_text_30")}</option>
                                            <option value="48 Hours SLA">{readData("components.Clerio.WorkflowBuilderModal", "WorkflowBuilderModal_text_31")}</option>
                                            <option value="72 Hours SLA">{readData("components.Clerio.WorkflowBuilderModal", "WorkflowBuilderModal_text_32")}</option>
                                        </select>
                                    </div>
                                )}

                                {selectedNode.type === 'condition' && (
                                    <div className={styles.inputGroup}>
                                        <label className={styles.inputLabel}>{readData("components.Clerio.WorkflowBuilderModal", "WorkflowBuilderModal_text_33")}</label>
                                        <select className={styles.selectInput} defaultValue="in">
                                            <option value="in">{readData("components.Clerio.WorkflowBuilderModal", "WorkflowBuilderModal_text_34")}</option>
                                            <option value="equals">{readData("components.Clerio.WorkflowBuilderModal", "WorkflowBuilderModal_text_35")}</option>
                                            <option value="greater">{readData("components.Clerio.WorkflowBuilderModal", "WorkflowBuilderModal_text_36")}</option>
                                            <option value="less">{readData("components.Clerio.WorkflowBuilderModal", "WorkflowBuilderModal_text_37")}</option>
                                        </select>
                                    </div>
                                )}

                                <button type="submit" className={styles.btnSimulate} style={{ background: '#2563eb', justifyContent: 'center' }}>
                                    <Save size={15} />{readData("components.Clerio.WorkflowBuilderModal", "WorkflowBuilderModal_text_38")}</button>

                                <button
                                    type="button"
                                    className={styles.deleteBtn}
                                    onClick={() => {
                                        deleteWorkflowNode(activeWorkflowId, selectedNode.id);
                                        setSelectedNodeId(null);
                                    }}
                                >
                                    <Trash2 size={14} />{readData("components.Clerio.WorkflowBuilderModal", "WorkflowBuilderModal_text_39")}</button>
                            </form>
                        ) : (
                            <div className={styles.emptyState}>
                                <Layers size={36} color="#cbd5e1" />
                                <p>{readData("components.Clerio.WorkflowBuilderModal", "WorkflowBuilderModal_text_40")}</p>
                                <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{readData("components.Clerio.WorkflowBuilderModal", "WorkflowBuilderModal_text_41")}<strong>{readData("components.Clerio.WorkflowBuilderModal", "WorkflowBuilderModal_text_42")}</strong>{readData("components.Clerio.WorkflowBuilderModal", "WorkflowBuilderModal_text_43")}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WorkflowBuilderModal;
