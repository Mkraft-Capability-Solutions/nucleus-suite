"use client";
import {useTranslation} from '@/context/I18nContext';

import NextImage from 'next/image';

import { readData } from '../../services/workspace-data.mjs';

import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, X, Hash, User, ShieldCheck } from 'lucide-react';
import styles from './ChatPanel.module.css';

const initialConversations = readData("components.Clerio.ChatPanel", "initialConversations_1");

const ChatPanel = ({ onClose }) => {
    const {t: translateText}=useTranslation();

    const [activeChannel, setActiveChannel] = useState(readData("components.Clerio.ChatPanel", "initialState_1"));
    const [conversations, setConversations] = useState(initialConversations);
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef(null);

    const currentConv = conversations[activeChannel] || conversations['direct_trisha'];

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView(readData("components.Clerio.ChatPanel", "scrollToBottom_2"));
    };

    useEffect(() => {
        scrollToBottom();
    }, [activeChannel, conversations]);

    const handleSend = (e) => {
        if (e) e.preventDefault();
        const text = inputValue.trim();
        if (!text) return;

        const newMsg = {
            id: Date.now(),
            ...readData("components.Clerio.ChatPanel", "newMsg_fields_3"),
            text,
            time: new Date().toLocaleTimeString([], readData("components.Clerio.ChatPanel", "time_5")),
            ...readData("components.Clerio.ChatPanel", "newMsg_fields_4")
        };

        setConversations(prev => ({
            ...prev,
            [activeChannel]: {
                ...prev[activeChannel],
                ...readData("components.Clerio.ChatPanel", "activeChannel_fields_6"),
                messages: [...prev[activeChannel].messages, newMsg]
            }
        }));

        setInputValue('');
    };

    const handleSelectChannel = (key) => {
        setActiveChannel(key);
        setConversations(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                ...readData("components.Clerio.ChatPanel", "key_fields_7")
            }
        }));
    };

    return (
        <div
            className={styles.floatingChatContainer}
            style={{
                position: 'fixed',
                bottom: '7.25rem',
                right: '2rem',
                width: '420px',
                maxHeight: 'calc(100vh - 9rem)',
                zIndex: 9999,
                pointerEvents: 'auto'
            }}
            role="dialog"
            aria-label={readData("components.Clerio.ChatPanel", "ChatPanel_aria-label_8")}
        >
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.chatIconBadge}>
                        <MessageSquare size={18} />
                    </div>
                    <div className={styles.titleBlock}>
                        <strong>{readData("components.Clerio.ChatPanel", "ChatPanel_text_9")}</strong>
                        <span>{readData("components.Clerio.ChatPanel", "ChatPanel_text_10")}</span>
                    </div>
                </div>
                <button
                    className={styles.closeBtn}
                    onClick={onClose}
                    title={readData("components.Clerio.ChatPanel", "ChatPanel_title_11")}
                    aria-label={readData("components.Clerio.ChatPanel", "ChatPanel_aria-label_12")}
                >
                    <X size={15} />
                </button>
            </div>

            {/* Channels Strip */}
            <div className={styles.channelStrip}>
                {Object.entries(conversations).map(([key, conv]) => (
                    <button
                        key={key}
                        className={`${styles.channelTab} ${activeChannel === key ? styles.channelActive : ''}`}
                        onClick={() => handleSelectChannel(key)}
                    >
                        {conv.type === 'channel' ? <Hash size={13} /> : <User size={13} />}
                        <span>{conv.name}</span>
                        {conv.unread > 0 && <span className={styles.tabBadge}>{conv.unread}</span>}
                    </button>
                ))}
            </div>

            {/* Chat History */}
            <div className={styles.chatHistory}>
                {currentConv.messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`${styles.messageRow} ${msg.isOwn ? styles.isOwn : ''}`}
                    >
                        {!msg.isOwn && (
                            <NextImage unoptimized width={48} height={48} src={msg.avatar} alt={msg.sender} className={styles.avatar} />
                        )}
                        <div className={styles.messageBubble}>
                            <div className={styles.messageSender}>
                                <span>{msg.sender}</span>
                                <span className={styles.messageTime}>{msg.time}</span>
                            </div>
                            <div className={styles.messageContent}>
                                {msg.text}
                            </div>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Footer */}
            <form onSubmit={handleSend} className={styles.inputArea}>
                <input
                    type="text"
                    className={styles.chatInput}
                    placeholder={translateText("components.Clerio.ChatPanel","text_d869d3fc0f", {value1: String(currentConv.name)})}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                />
                <button
                    type="submit"
                    className={styles.sendBtn}
                    disabled={!inputValue.trim()}
                    aria-label={readData("components.Clerio.ChatPanel", "ChatPanel_aria-label_13")}
                >
                    <Send size={15} />
                </button>
            </form>
        </div>
    );
};

export default ChatPanel;
