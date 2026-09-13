'use client';
import {useId, useState} from 'react';
import DashboardOutlined from '@mui/icons-material/DashboardOutlined';
import PeopleOutline from '@mui/icons-material/PeopleOutline';
import CalendarTodayOutlined from '@mui/icons-material/CalendarTodayOutlined';
import ArrowForward from '@mui/icons-material/ArrowForward';
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutline';
import styles from './HomePreview.module.css';
type Preview = {label:string;title:string;preview:string;queueLabel:string;statusLabel:string;roles:{id:string;label:string;greeting:string;description:string;cards:{label:string;value:string;detail:string}[];tasks:string[]}[]};
export default function HomePreview({copy}: {copy:Preview}) {
    const [selected,setSelected]=useState(0);
    const id=useId();
    const role=copy.roles[selected];
    return <section className={styles.preview} aria-label={copy.title}>
        <div className={styles.windowTop}><span><i/><i/><i/></span><small>{copy.preview}</small></div>
        <div className={styles.roles} role="tablist" aria-label={copy.title}>
            {copy.roles.map((entry,index)=><button key={entry.id} id={`${id}-tab-${index}`} role="tab" aria-selected={index===selected} aria-controls={`${id}-panel`} tabIndex={index===selected?0:-1} onClick={()=>setSelected(index)} onKeyDown={event=>{
                let next=index;
                if(event.key==='ArrowRight')next=(index+1)%copy.roles.length;
                else if(event.key==='ArrowLeft')next=(index+copy.roles.length-1)%copy.roles.length;
                else if(event.key==='Home')next=0;
                else if(event.key==='End')next=copy.roles.length-1;
                else return;
                event.preventDefault();setSelected(next);document.getElementById(`${id}-tab-${next}`)?.focus();
            }}>{entry.label}</button>)}
        </div>
        <div className={styles.workspace}>
            <aside aria-hidden="true"><DashboardOutlined/><PeopleOutline/><CalendarTodayOutlined/></aside>
            <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${selected}`} className={styles.panel} tabIndex={0}>
                <div className={styles.kicker}>{copy.label}</div><h2>{role.greeting}</h2><p>{role.description}</p>
                <div className={styles.cards}>{role.cards.map(card=><article key={card.label}><span>{card.label}</span><h3>{card.value}</h3><p>{card.detail}</p></article>)}</div>
                <div className={styles.queue}><h3>{copy.queueLabel}</h3>{role.tasks.map(task=><div key={task}><CheckCircleOutline fontSize="small"/><span>{task}</span><ArrowForward fontSize="small" aria-hidden="true"/></div>)}</div>
            </div>
        </div>
    </section>;
}
