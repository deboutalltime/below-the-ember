import { mkdirSync, writeFileSync } from 'node:fs';
import { Run, TILE, type Enemy } from '../src/simulation';
import { astar, los, type Cell } from '../src/ai';
import { center } from '../src/dungeon';
import { searchGrid } from '../src/intelligence/search';

// A deterministic, omniscient test driver. It uses normal actions and simulation
// updates. It never removes enemies, completes objectives, teleports or boosts stats.
// This is an integration experiment, not a manual browser playthrough.
const seed = process.argv[2] ?? 'qairu-final-2026';
const run = new Run(seed), dt = .04, floors: object[] = [];
let ticks = 0, route: Cell[] = [], routeKey = '', repath = 0, oldFloor = 0;
const position = () => ({x:run.x / TILE, y:run.y / TILE});
const point = (p: Cell) => ({x:(p.x+.5)*TILE,y:(p.y+.5)*TILE});
const distance = (p: {x:number;y:number}) => Math.hypot(p.x-run.x,p.y-run.y);
const preference = [14,9,5,2,3,0,4,17,13,11,6,7,8,1,16,12,10,15];
function pathTo(target: Cell) {
  const cell = {x:Math.floor(run.x/TILE),y:Math.floor(run.y/TILE)};
  const k = `${run.floor}:${target.x},${target.y}:${run.mapRevision}`;
  if (k !== routeKey || repath-- <= 0 || !route.length) {
    route = searchGrid(run.d.grid,cell,target,'A*',run.costs).path;
    routeKey=k; repath=8;
  }
  while(route.length && distance(point(route[0]))<5) route.shift();
  const next = route[0] ? point(route[0]) : point(target);
  return {x:next.x-run.x,y:next.y-run.y};
}
function macroTarget(): Cell {
  const activeDefense=[...run.encounters.values()].find(e=>e.type==='defense' && e.started && !e.complete);
  if(activeDefense) return center(run.d.rooms[activeDefense.room]);
  const collapse=run.encounters.get(run.room);
  if(collapse?.type==='collapse' && !collapse.complete && !run.enemies.some(e=>e.room===run.room)) {
    const room=run.d.rooms[run.room], exits:Cell[]=[];
    for(let y=room.y-1;y<=room.y+room.h;y++) for(let x=room.x-1;x<=room.x+room.w;x++)
      if((x<room.x || x>=room.x+room.w || y<room.y || y>=room.y+room.h) && run.d.grid[y]?.[x]===1) exits.push({x,y});
    const cell={x:Math.floor(run.x/TILE),y:Math.floor(run.y/TILE)};
    exits.sort((a,b)=>astar(run.d.grid,cell,a).path.length-astar(run.d.grid,cell,b).path.length);
    if(exits[0]) return exits[0];
  }
  const needs=[2,3,1,4,5,6].find(index => !run.visited.includes(index) || run.encounters.has(index) && !run.encounters.get(index)!.complete);
  if(needs!==undefined) return center(run.d.rooms[needs]);
  if(run.enemies.length) {
    const enemy=run.enemies.reduce((a,b)=>distance(a)<distance(b)?a:b);
    return {x:Math.floor(enemy.x/TILE),y:Math.floor(enemy.y/TILE)};
  }
  return center(run.d.rooms.at(-1)!);
}
for(;ticks<45000 && run.status!=='dead' && run.status!=='victory';ticks++) {
  if(oldFloor!==run.floor) { oldFloor=run.floor; route=[];routeKey=''; console.log(`Floor ${run.floor}: HP ${run.hp}, enemies ${run.enemies.length}, damage ${run.damage.toFixed(1)}`); }
  if(run.status==='upgrade') {
    const healing=run.hp<run.maxHP*.6 ? run.picks.find(i=>i===0 || i===6) : undefined;
    const pick=healing ?? preference.find(i=>run.picks.includes(i)) ?? run.picks[0]; run.choose(pick); continue;
  }
  if(run.status==='event') { run.selectEvent(run.event?.kind==='trial'?'decline':run.event?.kind==='choice'?'rest':'leave'); continue; }
  if(run.status==='duel') { run.closeDuel(); continue; }
  if(run.status==='camp') {
    floors.push({floor:run.floor,hp:run.hp,kills:run.floorKills,objectives:[...run.encounters.values()].map(e=>({type:e.type,complete:e.complete,time:e.time})),elapsed:run.elapsed});
    run.campAction('forge'); while(run.potions<4 && run.campAction('potion')) {} run.campAction('descend'); continue;
  }
  if(run.hp<run.maxHP-29) run.heal();
  const pos=position();
  const targets=run.enemies.filter(e=>distance(e)<390 && los(run.d.grid,pos,{x:e.x/TILE,y:e.y/TILE})).sort((a,b)=>distance(a)-distance(b));
  const enemy=targets[0];
  let move=pathTo(macroTarget()), shoot=Boolean(enemy), dash=false;
  const length=Math.hypot(move.x,move.y); if(length) {move.x/=length;move.y/=length;}
  if(enemy) {
    const d=distance(enemy), ideal=enemy.kind===4?185:145;
    if(d<ideal-30) {move={x:(run.x-enemy.x)/d,y:(run.y-enemy.y)/d};}
    else if(d<ideal+45) {move={x:-(enemy.y-run.y)/d*.7,y:(enemy.x-run.x)/d*.7};}
    run.selectWeapon(d<80?1:0);
  }
  // Pick a locally safe motion while retaining progress toward the route or retreat.
  const options=[move,{x:move.y,y:-move.x},{x:-move.y,y:move.x},{x:-move.x,y:-move.y},{x:0,y:0}];
  let best=move,bestScore=-Infinity;
  for(const candidate of options) {
    const x=run.x+candidate.x*run.speed*dt,y=run.y+candidate.y*run.speed*dt;
    if(!run.free(x,y)) continue;
    let score=(candidate.x*move.x+candidate.y*move.y)*3;
    const cost=run.costs[Math.floor(y/TILE)]?.[Math.floor(x/TILE)]??100; score-=(cost-1)*3;
    for(const bullet of run.bullets) if(bullet.hostile && Math.hypot(bullet.x-run.x,bullet.y-run.y)<90) {
      const bx=bullet.x+bullet.vx*.16,by=bullet.y+bullet.vy*.16;
      score-=Math.max(0,45-Math.hypot(bx-x,by-y));
    }
    if(score>bestScore){bestScore=score;best=candidate;}
  }
  move=best;
  const closeBullet=run.bullets.some(b=>b.hostile&&distance(b)<32);
  dash=run.dash<=0 && (closeBullet || Boolean(enemy && distance(enemy)<40));
  const angle=enemy?Math.atan2(enemy.y-run.y,enemy.x-run.x):0;
  run.update(dt,{...move,shoot,angle,dash,alternate:false});
  if(run.exitReady && distance(point(center(run.d.rooms.at(-1)!)))<40) run.interact();
  if(ticks%2500===0 && ticks) console.log(`t=${run.elapsed.toFixed(0)} floor=${run.floor} HP=${run.hp.toFixed(0)} foes=${run.enemies.length} room=${run.room} pos=${(run.x/TILE).toFixed(1)},${(run.y/TILE).toFixed(1)} target=${JSON.stringify(macroTarget())}`);
}
if(run.status==='victory') floors.push({floor:5,hp:run.hp,kills:run.floorKills,objectives:[...run.encounters.values()].map(e=>({type:e.type,complete:e.complete,time:e.time})),elapsed:run.elapsed});
const result={seed,status:run.status,floor:run.floor,hp:run.hp,kills:run.kills,elapsed:run.elapsed,ticks,floors,reason:run.deathReason,verification:'Automated simulation with normal actions. Omniscient test driver; no enemy deletion, objective overrides, teleportation or boosted statistics. Not a human playthrough.'};
mkdirSync('docs/results',{recursive:true}); writeFileSync('docs/results/campaign.json',JSON.stringify(result,null,2)); console.log(JSON.stringify(result,null,2));
if(run.status!=='victory') process.exitCode=1;
