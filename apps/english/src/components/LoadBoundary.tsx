import React from 'react';
export class LoadBoundary extends React.Component<{children:React.ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<div role="alert" className="platform-empty"><p>页面载入失败，已保存的学习记录仍保留。</p><button onClick={()=>location.reload()}>重新载入</button></div>:this.props.children;}
}
