import { r as React } from './vendor-C1PfG1cZ.js';
const get=(key,fallback)=>window.studyPosition?.get('math:'+key)?.value??fallback;
const put=(key,value)=>window.studyPosition?.set('math:'+key,{value});
function useScroll(key,ready){const name='scroll:'+key,restored=React.useRef('');React.useEffect(()=>{let timer;const save=()=>{clearTimeout(timer);timer=setTimeout(()=>put(name,Math.round(scrollY)),250);};window.addEventListener('scroll',save,{passive:true});return()=>{clearTimeout(timer);window.removeEventListener('scroll',save);put(name,Math.round(scrollY));};},[name]);React.useEffect(()=>{if(!ready||restored.current===name)return;restored.current=name;const y=get(name,0);if(y>0)requestAnimationFrame(()=>scrollTo(0,y));},[ready,name]);}
function useIndex(key,count){const name='idx:'+key,[index,setIndex]=React.useState(()=>Number(get(name,0))||0),current=React.useRef('');React.useEffect(()=>{current.current=name;setIndex(Number(get(name,0))||0);},[name]);React.useEffect(()=>{if(count>0&&current.current===name)put(name,index);},[index,name,count]);return[count>0?Math.min(index,count-1):0,setIndex];}
function readPick(key,fallback){const value=Number(get('pick:'+key,fallback));return Number.isFinite(value)&&value>0?value:fallback;}
function writePick(key,value){put('pick:'+key,value);}
export {useIndex as a,readPick as r,useScroll as u,writePick as w};
