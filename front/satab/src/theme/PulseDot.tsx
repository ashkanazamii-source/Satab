export function PulseDot() {
  return (
    <span style={{
      position:'relative', display:'inline-block', width:10, height:10, borderRadius:'50%',
      background:'#22D3EE', boxShadow:'0 0 0 0 rgba(34,211,238,.6)', animation:'pulse 2s infinite'
    }}/>
  );
}