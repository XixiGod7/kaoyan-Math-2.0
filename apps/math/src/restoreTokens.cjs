// Malformed private Unicode is ordinary text, never a reason to keep looping.
function restoreTokens(text, values, start='\ue000', end='\ue001') {
  const expression = new RegExp(start+'(\\d+)'+end,'g');
  for (let pass=0; pass<=values.length; pass++) {
    const next=text.replace(expression,(original,index)=>Object.hasOwn(values,Number(index))?values[Number(index)]:original);
    if (next===text) return text;
    text=next;
  }
  return text;
}
module.exports=restoreTokens;
