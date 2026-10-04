import {useEffect} from 'react';
export type StudyTarget={year:string;number:number;open?:boolean};
export function selectStudyTarget(year:string|number,number:number,open=false){
  window.dispatchEvent(new CustomEvent('english:target',{detail:{year:String(year),number,open}}));
}
export function useStudyTarget(year:string|number,number:number){
  useEffect(()=>{selectStudyTarget(year,number);},[year,number]);
}
export function QuestionNote({year,number}:{year:string|number;number:number}){
  return <button type="button" className="question-note-link" onClick={()=>selectStudyTarget(year,number,true)} aria-label={`${year} 年第 ${number} 题笔记`}>记笔记</button>;
}
