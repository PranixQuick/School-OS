require('@next/env').loadEnvConfig(process.cwd());

const pat = process.env.GITHUB_PAT;

async function checkPR(repo, prNumber) {
  const res = await fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}`, {
    headers: {
      'Authorization': `Bearer ${pat}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });
  
  if (res.ok) {
    const data = await res.json();
    console.log(`Repo: ${repo}, PR #${prNumber}`);
    console.log(`State: ${data.state}`);
    console.log(`Merged: ${data.merged}`);
    console.log(`Merged At: ${data.merged_at}`);
  } else {
    console.error(`Failed to fetch PR #${prNumber} for ${repo}:`, res.status);
  }
}

async function run() {
  await checkPR('PranixQuick/School-OS', 286);
  await checkPR('PranixQuick/pranix-aaria', 23);
}

run().catch(console.error);
