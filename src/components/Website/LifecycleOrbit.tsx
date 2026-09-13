'use client';
import {useId, useState} from 'react';
import Image from 'next/image';
import PeopleOutline from '@mui/icons-material/PeopleOutline';
import TrendingUp from '@mui/icons-material/TrendingUp';
import WorkspacePremiumOutlined from '@mui/icons-material/WorkspacePremiumOutlined';
import SupportAgentOutlined from '@mui/icons-material/SupportAgentOutlined';
import HubOutlined from '@mui/icons-material/HubOutlined';
import type {HomeStoryCopy} from './HomeStory';
import styles from './HomeStory.module.css';
const icons={people:PeopleOutline,growth:TrendingUp,reward:WorkspacePremiumOutlined,support:SupportAgentOutlined,manage:HubOutlined};
export default function LifecycleOrbit({copy}:{copy:HomeStoryCopy}) {
 const [selected,setSelected]=useState(0);
 const id=useId();
 return <div className={styles.orbitWrap}>
  <div className={styles.orbit} role="group" aria-label={copy.orbitLabel}>
   <div className={styles.rings} aria-hidden="true"><i/><i/><i/></div>
   <div className={styles.nucleus}><Image src="/images/logo.png" alt="" width={100} height={100}/><span>{copy.orbitCenter}</span></div>
   {copy.stages.map((stage,index)=>{const Icon=icons[stage.icon as keyof typeof icons];return <button key={stage.id} className={styles.node} aria-pressed={selected===index} aria-controls={`${id}-description`} onClick={()=>setSelected(index)}><Icon/><strong>{stage.label}</strong><span>{stage.detail}</span></button>;})}
  </div>
  <div className={styles.orbitDescription} id={`${id}-description`} aria-live="polite"><small>{copy.orbitHint}</small><p key={selected}>{copy.stages[selected].description}</p></div>
 </div>;
}
