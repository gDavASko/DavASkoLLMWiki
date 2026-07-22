import os
import sys
import subprocess
import json
import uuid
import time
from pathlib import Path

def init_vault():
    print("Checking vault init...")
    if not os.path.exists(".hyperresearch"):
        subprocess.run(["python", "-m", "hyperresearch.cli", "init", ".", "--json"], shell=False)

def generate_vault_tag(slug):
    suffix = uuid.uuid4().hex[:6]
    return f"{slug}-{suffix}"

def run_step(step_num, agent_file, task_prompt, cwd):
    print(f"--- Running Step {step_num}: {agent_file} ---")
    script_dir = os.path.dirname(os.path.abspath(__file__))
    ag_agent = os.path.join(script_dir, "ag_agent.py")
    
    cmd = [sys.executable, ag_agent, agent_file, task_prompt]
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, encoding='utf-8')
    print(result.stdout)
    if result.returncode != 0:
        print(f"Error in step {step_num}: {result.stderr}")
        return False
    return True

def main():
    if len(sys.argv) < 2:
        print("Usage: python ag_orchestrator.py <research_query>")
        sys.exit(1)
        
    query = sys.argv[1]
    
    # We run in the project root to match hyperresearch norms
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
    print(f"Project root: {project_root}")
    
    os.makedirs(os.path.join(project_root, "research"), exist_ok=True)
    os.makedirs(os.path.join(project_root, "research/temp"), exist_ok=True)
    os.makedirs(os.path.join(project_root, "research/notes"), exist_ok=True)
    
    slug = query.lower().replace(" ", "-")[:20]
    vault_tag = generate_vault_tag(slug)
    
    query_file_rel = f"research/query-{vault_tag}.md"
    query_file_abs = os.path.join(project_root, query_file_rel)
    
    with open(query_file_abs, 'w', encoding='utf-8') as f:
        f.write(f"---\nvault_tag: {vault_tag}\nsource: user-prompt\n---\n\n{query}")
        
    print(f"Vault tag: {vault_tag}")
    
    skills_dir = os.path.join(project_root, "Assets", "KBPro", "kbpro-ai-docs", "all-skills~")
    
    # 1. Decompose
    step1_agent = os.path.join(skills_dir, "hyperresearch-1-decompose", "SKILL.md")
    step1_prompt = f"Run step 1 decomposition for canonical query in {query_file_rel}. Output to research/prompt-decomposition.json"
    success = run_step(1, step1_agent, step1_prompt, project_root)
    
    if not success:
        return
        
    decomp_path = os.path.join(project_root, "research", "prompt-decomposition.json")
    if not os.path.exists(decomp_path):
        print(f"FATAL ERROR: Step 1 failed to create {decomp_path}")
        return
        
    print("Step 1 complete. Reading tier...")
    try:
        with open(decomp_path, 'r', encoding='utf-8') as f:
            decomp = json.load(f)
            tier = decomp.get("pipeline_tier", "full")
    except Exception as e:
        print(f"FATAL ERROR: Could not read tier: {e}")
        return
        
    print(f"Pipeline tier: {tier}")
    
    # Run step 2 Width Sweep
    step2_agent = os.path.join(skills_dir, "hyperresearch-2-width-sweep", "SKILL.md")
    step2_prompt = f"Run step 2 width sweep for vault_tag {vault_tag} based on canonical query in {query_file_rel}"
    run_step(2, step2_agent, step2_prompt, project_root)
    
    if tier == "light":
        print("Light tier: Running steps 10, 15, 16")
        
        step10_agent = os.path.join(skills_dir, "hyperresearch-10-triple-draft", "SKILL.md")
        run_step(10, step10_agent, f"Run step 10 draft for vault_tag {vault_tag}", project_root)
        
        step15_agent = os.path.join(skills_dir, "hyperresearch-15-polish", "SKILL.md")
        run_step(15, step15_agent, f"Run step 15 polish for vault_tag {vault_tag}", project_root)
        
        step16_agent = os.path.join(skills_dir, "hyperresearch-16-readability-audit", "SKILL.md")
        run_step(16, step16_agent, f"Run step 16 readability audit for vault_tag {vault_tag}", project_root)
        
    else:
        print("Full tier requested. Running steps 3 through 16.")
        
        steps = [
            (3, "hyperresearch-3-contradiction-graph"),
            (4, "hyperresearch-4-loci-analysis"),
            (5, "hyperresearch-5-depth-investigation"),
            (6, "hyperresearch-6-cross-locus-reconcile"),
            (7, "hyperresearch-7-source-tensions"),
            (8, "hyperresearch-8-corpus-critic"),
            (9, "hyperresearch-9-evidence-digest"),
            (10, "hyperresearch-10-triple-draft"),
            (11, "hyperresearch-11-synthesize"),
            (12, "hyperresearch-12-critics"),
            (13, "hyperresearch-13-gap-fetch"),
            (14, "hyperresearch-14-patcher"),
            (15, "hyperresearch-15-polish"),
            (16, "hyperresearch-16-readability-audit")
        ]
        
        for step_num, agent_name in steps:
            agent_file = os.path.join(skills_dir, agent_name, "SKILL.md")
            prompt = f"Run step {step_num} ({agent_name}) for vault_tag {vault_tag} based on canonical query in {query_file_rel}"
            success = run_step(step_num, agent_file, prompt, project_root)
            if not success:
                print(f"FATAL ERROR: Step {step_num} failed. Halting pipeline.")
                return
                
    print(f"\nPipeline complete! Final report should be at: research/notes/final_report_{vault_tag}.md")

if __name__ == "__main__":
    main()
