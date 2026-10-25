import { mkdirSync, writeFileSync } from 'node:fs';
import { generate, validate, GenerationInputError } from '../src/dungeon';
import { astar, Agent } from '../src/ai';
import { minimaxMove } from '../src/intelligence/minimax';
import { QLearner } from '../src/intelligence/learning';
import { searchGrid } from '../src/intelligence/search';

const grid = Array.from({length:18}, (_,y)=>Array.from({length:24},(_,x)=>x===0||y===0||x===23||y===17||x===11&&y>3&&y<15&&y!==10?0:1));
const route=astar(grid,{x:2,y:2},{x:20,y:14},true);
const costsGrid=Array.from({length:9},()=>Array(14).fill(1)); const costs=costsGrid.map(r=>r.map(()=>1));
for(let x=4;x<10;x++) costs[4][x]=10;
const comparison=Object.fromEntries((['BFS','Dijkstra','A*'] as const).map(method=>{
    const r=searchGrid(costsGrid,{x:1,y:4},{x:12,y:4},method,costs);
    return [method,{moves:r.path.length-1,cost:r.cost,visited:r.visited.length}];
}));
const normal=generate('ember-2026'),dense=generate('dense-trace',1,48,12,4);
const learner=new QLearner(); const before=learner.policy(); learner.train(1000,.2,.95);
const pruned=minimaxMove(Array(9).fill(0),true),full=minimaxMove(Array(9).fill(0),false);
const open=Array.from({length:12},()=>Array(12).fill(1)),agent=new Agent({x:2.5,y:2.5}),pos={x:2.5,y:2.5},player={x:5.5,y:2.5};
const states=[agent.observe(open,pos,player,.1),agent.observe(open,pos,player,.4),agent.observe(open,pos,{x:3,y:2.5},.1)];
open[2][4]=0; states.push(agent.observe(open,pos,player,.1),agent.observe(open,pos,player,6));
const invalid=[6.5,0,100,NaN,Infinity].map(value=>{
    try {generate('invalid',1,64,value);return {input:String(value),rejected:false};}
    catch(error){return {input:String(value),rejected:error instanceof GenerationInputError,message:(error as Error).message};}
});
const result={date:'2026-10-25',version:'2.3.2',
    primaryWeeks:{1:'Intelligent Agents',2:'A* Search',3:'Constraint Satisfaction Problems'},
    csp:{normal:{rooms:normal.rooms.length,connected:validate(normal),trace:normal.attempts.length,...normal.generation},dense:{rooms:dense.rooms.length,connected:validate(dense),trace:dense.attempts.length,...dense.generation}},
    invalidRoomCounts:invalid,agentTransitions:states,
    astar:{moves:route.path.length-1,closed:route.closed.length,traceSteps:route.steps.length},searchComparison:comparison,
    minimax:{pruned:{move:pruned.move+1,value:pruned.value,nodes:pruned.nodes,cutoffs:pruned.cutoffs},full:{move:full.move+1,value:full.value,nodes:full.nodes}},
    learning:{episodes:learner.episodes,before:before.reason,after:learner.policy().reason,recentTrainingSuccess:learner.successes.slice(-50).reduce((a,b)=>a+b,0)/50,scope:'Fixed educational arena. Training result only; campaign enemies do not use Q-learning.'}
};
mkdirSync('docs/results',{recursive:true});writeFileSync('docs/results/metrics.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
