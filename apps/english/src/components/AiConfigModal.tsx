import {useEffect} from 'react';
export function AiConfigModal({isOpen,onClose}:{isOpen:boolean;onClose:()=>void;theme?:string;onSaved?:()=>void}){useEffect(()=>{if(isOpen){window.dispatchEvent(new Event('open-ai-settings'));onClose();}},[isOpen]);return null;}
