const userInput = document.querySelector('article.user-input');
const form = userInput.querySelector('form');
const inputTable = form.querySelector('table');
const tbody = inputTable.querySelector('tbody');
const simulation = document.querySelector('article.simulation');
const timeUnitTable = simulation.querySelector('.timeUnitTable');
const memory = simulation.querySelector('aside');
const flow = simulation.querySelector('.bottom section');
let given = {
  memorySize: 0,
  algorithm: '',
  jobs: [],
  timeCompaction: 0,
  coalescingHole: 0,
  currentTimeUnit: 1,
}
let largestTU = 0;
let jobsInMemory;

function addRow(){
  const jobNumber = tbody.children.length + 1;
  const succeedingTR = tbody.querySelector('tr:last-child');
  const tr = document.createElement('tr');
  
  tr.innerHTML +=`
    <td>${jobNumber}</td>
    <td>
      <input type="number" name="size${jobNumber}" id="size${jobNumber}" min="10" required>
    </td>
    <td>
      <input type="number" name="timeUnit${jobNumber}" id="timeUnit${jobNumber}" min="1" required>
    </td>`;
  
  succeedingTR.after(tr);
}

// Submit Form
form.addEventListener('submit', e => {
  e.preventDefault();

  const memorySize = form.querySelector('#memorySize').value;
  const algorithm = form.querySelector('#algorithm').value;
  const timeCompaction = form.querySelector('#timeCompaction').value;
  const coalescingHole = form.querySelector('#coalescingHole').value;
  const TRs = tbody.children;

  given.jobs = [];

  for(let i = 0; i < TRs.length; i++){
    const sizeVal = parseInt(TRs[i].querySelector(`#size${i + 1}`).value);
    const timeUnitVal = parseInt(TRs[i].querySelector(`#timeUnit${i + 1}`).value);

    given.jobs.push({
      number: i + 1,
      size: sizeVal,
      timeUnit: timeUnitVal,
      timeUnitLeft: timeUnitVal,
      allocated: false,
      done: false,
    });
    if(largestTU < timeUnitVal){
      largestTU = timeUnitVal;
    }
  }

  given.memorySize = memorySize * 1000;
  given.timeCompaction = timeCompaction;
  given.coalescingHole = coalescingHole;
  given.algorithm = algorithm;

  startSimulation();
});

async function startSimulation(){
  generateContent();

  while(totalTimeUnitsLeft() > 0){
    updateJobsInMemory();
    for(let job of given.jobs){
      const {number, size, allocated, done} = job;
  
      if(done) continue;
  
      if(!allocated){
        switch(given.algorithm){
          case 'First Fit':
            firstFitAllocate(job);
            break;
          case 'Best Fit':
            bestFitAllocate(job);
            break;
          case 'Worst Fit':
            worstFitAllocate(job);
            break;
        }
      }
  
      updateJobsInMemory();

      if(job.allocated){
        const isDeallocated = await updateContent(job);
    
        await delay();
        if(isDeallocated){
          await allocatePendingJobs();
        }
        if(given.currentTimeUnit % given.timeCompaction === 0){
          await timeCompaction();
        }
      }
    }
  }
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms || 1000));
const totalTimeUnitsLeft = () => given.jobs.reduce((total, job) => total + job.timeUnitLeft, 0);
function generateContent(){
  userInput.style.display = 'none';
  simulation.style.display = 'block';

  let content = `
    <thead>
      <tr>
        <th>Job</th>
        <th>Size(KB)</th>
        <th colspan="${largestTU + 1}">Time Unit</th>
      </tr>
    </thead>
    <tbody>`;
  for(let job of given.jobs){
    content += `
      <tr>
        <td>${job.number}</td>
        <td>${job.size}</td>
        <td>${job.timeUnit}</td>`;
    for(let i = 0; i < largestTU; i++){
      content += `<td class="TU"></td>`;
    }
    content += `</tr>`;
  }
  content += '</tbody>';

  timeUnitTable.innerHTML = content;
  memory.style.gridTemplateRows = `repeat(${given.memorySize}, 1fr)`;
}
function updateJobsInMemory(){
  jobsInMemory = Array.from(memory.querySelectorAll('div'));

  jobsInMemory.sort((a, b) => {
    const RowA = a.style.gridRow.split('/')[0];
    const RowB = b.style.gridRow.split('/')[0];
    return parseInt(RowA) - parseInt(RowB);
  });
  jobsInMemory.forEach(div => memory.appendChild(div));
}
function getBounds(element){
  const bounds = element.style.gridRow.split('/');
  return {start: parseInt(bounds[0]), end: parseInt(bounds[1])};
}

// First-Fit Logic
function firstFitAllocate(job){
  const {number, size} = job;

  if(jobsInMemory.length === 0 && size <= given.memorySize){
    memory.innerHTML += `<div class="J${number}" style="grid-row: 1/${size};">J${number} - ${size}</div>`;
    job.allocated = true;
  }
  else{
    let start, end;

    for(let i = 0; i <= jobsInMemory.length; i++){
      if(i === 0){
        start = 0;
        end = getBounds(jobsInMemory[i]).start;
      }
      else if(i === jobsInMemory.length){
        start = getBounds(jobsInMemory[i - 1]).end;
        end = given.memorySize;
      }
      else{
        start = getBounds(jobsInMemory[i - 1]).end;
        end = getBounds(jobsInMemory[i]).start;
      }
      if(size <= end - start){
        memory.innerHTML += `<div class="J${number}" style="grid-row: ${(start === 0) ? 1 : start}/${start + size};">J${number} - ${size}</div>`;
        job.allocated = true;
        break;
      }
    }
  }
}
// Best-Fit Logic
function bestFitAllocate(job){
  const {number, size} = job;
  let bestFitIndex = -1;
  let bestFitSize = Infinity;

  for(let i = 0; i <= jobsInMemory.length; i++){
    let start, end;

    if(i === 0){
      start = 0;
      end = jobsInMemory.length > 0 ? getBounds(jobsInMemory[i]).start : given.memorySize;
    }
    else if(i === jobsInMemory.length){
      start = getBounds(jobsInMemory[i - 1]).end;
      end = given.memorySize;
    }
    else{
      start = getBounds(jobsInMemory[i - 1]).end;
      end = getBounds(jobsInMemory[i]).start;
    }

    const holeSize = end - start;
    if(size <= holeSize && holeSize < bestFitSize){
      bestFitIndex = i;
      bestFitSize = holeSize;
    }
  }

  if(bestFitIndex !== -1){
    let start, end;
    if(bestFitIndex === 0){
      start = 0;
      end = jobsInMemory.length > 0 ? getBounds(jobsInMemory[bestFitIndex]).start : given.memorySize;
    }
    else if(bestFitIndex === jobsInMemory.length){
      start = getBounds(jobsInMemory[bestFitIndex - 1]).end;
      end = given.memorySize;
    }
    else{
      start = getBounds(jobsInMemory[bestFitIndex - 1]).end;
      end = getBounds(jobsInMemory[bestFitIndex]).start;
    }

    memory.innerHTML += `<div class="J${number}" style="grid-row: ${(start === 0) ? 1 : start}/${start + size};">J${number} - ${size}</div>`;
    job.allocated = true;
  }
}
// Worst-Fit Logic
function worstFitAllocate(job){
  const {number, size} = job;
  let worstFitIndex = -1;
  let worstFitSize = -1;

  for(let i = 0; i <= jobsInMemory.length; i++){
    let start, end;

    if(i === 0){
      start = 0;
      end = jobsInMemory.length > 0 ? getBounds(jobsInMemory[i]).start : given.memorySize;
    }
    else if(i === jobsInMemory.length){
      start = getBounds(jobsInMemory[i - 1]).end;
      end = given.memorySize;
    }
    else{
      start = getBounds(jobsInMemory[i - 1]).end;
      end = getBounds(jobsInMemory[i]).start;
    }

    const holeSize = end - start;
    if(size <= holeSize && holeSize > worstFitSize){
      worstFitIndex = i;
      worstFitSize = holeSize;
    }
  }

  if(worstFitIndex !== -1){
    let start, end;
    if(worstFitIndex === 0){
      start = 0;
      end = jobsInMemory.length > 0 ? getBounds(jobsInMemory[worstFitIndex]).start : given.memorySize;
    }
    else if(worstFitIndex === jobsInMemory.length){
      start = getBounds(jobsInMemory[worstFitIndex - 1]).end;
      end = given.memorySize;
    }
    else{
      start = getBounds(jobsInMemory[worstFitIndex - 1]).end;
      end = getBounds(jobsInMemory[worstFitIndex]).start;
    }

    memory.innerHTML += `<div class="J${number}" style="grid-row: ${(start === 0) ? 1 : start}/${start + size};">J${number} - ${size}</div>`;
    job.allocated = true;
  }
}
// Allocate Pending Jobs When A Job is Deallocated
async function allocatePendingJobs(){
  for (let job of given.jobs) {
    const {allocated, done} = job;

    if(!allocated && !done){
      switch(given.algorithm){
        case 'First Fit':
          firstFitAllocate(job);
          break;
        case 'Best Fit':
          bestFitAllocate(job);
          break;
        case 'Worst Fit':
          worstFitAllocate(job);
          break;
      }

      if(job.allocated){
        await updateContent(job);
        await delay();
      }
    }
    updateJobsInMemory();
  }
}
// Update UI per Time Unit
async function updateContent(job){
  const {number, size, timeUnit, timeUnitLeft, allocated, done} = job;
  const cell = timeUnitTable.querySelector(`tbody tr:nth-child(${number}) .TU`);
  let deallocate = false;
  let jobDiv = undefined;
  
  cell.classList.remove('TU');
  if(--job.timeUnitLeft === 0){
    cell.innerText = '*';
    job.done = true;

    jobDiv = memory.querySelector(`.J${number}`);
    if(jobDiv){
      deallocate = true;
      memory.removeChild(jobDiv);
    }
  }
  else{
    cell.innerText = job.timeUnitLeft;
  }
  flow.innerHTML += `<div>J${number}</div>`;
  given.currentTimeUnit++;

  if(typeof jobDiv !== 'undefined' && deallocate && given.currentTimeUnit % given.coalescingHole === 0){
    await coalescingHole(jobDiv);
  }

  return deallocate;
}
// Time Compaction
async function timeCompaction(){
  let start = 1;

  for(let i = 0; i <= jobsInMemory.length; i++){
    if(i < jobsInMemory.length){
      const bounds = jobsInMemory[i].style.gridRow.split('/');
      const size = parseInt(bounds[1]) - parseInt(bounds[0]);
    
      jobsInMemory[i].style.gridRow = `${start}/${start + size}`;
      start += size;
  
      given.currentTimeUnit++;
    }

    flow.innerHTML += `<div>SC</div>`;
    await delay();
  }
}
// Coalescing Hole
async function coalescingHole(jobDiv){
  if(jobsInMemory.length === 1) return;
  for(let i = 0; i < jobsInMemory.length; i++){
    let coalesce = false, boundA1, boundB1, boundA2, boundB2;

    if(jobsInMemory[i] === jobDiv){
      if(i === 0){
        boundA1 = getBounds(jobsInMemory[i]).end;
        boundB1 = getBounds(jobsInMemory[i + 1]).start;
        if(boundA1 < boundB1)
          coalesce = true;
      }
      else if(i === jobsInMemory.length - 1){
        boundA1 = getBounds(jobsInMemory[i]).start;
        boundB1 = getBounds(jobsInMemory[i - 1]).end;
        if(boundA1 > boundB1)
          coalesce = true;
      }
      else{
        boundA1 = getBounds(jobsInMemory[i]).start;
        boundA2 = getBounds(jobsInMemory[i]).end;
        boundB1 = getBounds(jobsInMemory[i - 1]).end;
        boundB2 = getBounds(jobsInMemory[i + 1]).start;
        if(boundA1 > boundB1 || boundA2 < boundB2)
          coalesce = true;
      }
    }
    if(coalesce){
      await delay();
      given.currentTimeUnit++;
      flow.innerHTML += `<div>CH</div>`;
    }
  }
}