"""
Send transcript to Gemini 2.5 Flash. Get back scene plan, cuts, stat overlays,
caption, hashtags, and overall mood. B-roll scenes map to short, search-friendly
Pexels keyword phrases (NOT AI generation prompts).
"""

import json
import time
from pathlib import Path
from google import genai
from google.genai import types


def analyse(transcript: dict, output_dir: Path, client: genai.Client,
            progress_callback=None) -> dict:
    """Analyse transcript with Gemini 2.5 Flash to produce a scene plan.

    Args:
        transcript: Dict with 'words' and 'full_text' from transcription.
        output_dir: Directory to save the analysis JSON.
        client: Initialized google-genai Client.

    Returns:
        Dict with scenes, suggested_cuts, stat_overlays, caption,
        hashtags, suggested_title, and overall_mood.
    """
    full_text = transcript["full_text"]
    words = transcript["words"]

    # Calculate video duration for minimum B-roll density
    # Target: 5-6 clips per 60 seconds
    if words:
        duration_seconds = max(words[-1].get("end", 60), 60)
        duration_minutes = duration_seconds / 60
    else:
        duration_minutes = 1.0
        duration_seconds = 60

    prompt = f"""You are a professional video director and social media editor for health and nutrition content.

Analyse this transcript and return ONLY valid JSON with this exact structure — no markdown, no code fences, no other text:

{{
  "scenes": [
    {{
      "start": float,
      "end": float,
      "tone": "educational|inspirational|cautionary|conversational",
      "narration_summary": "one sentence summary of what speaker says here"
    }}
  ],
  "suggested_cuts": [
    {{
      "start": float,
      "end": float,
      "reason": "string",
      "confidence": float
    }}
  ],
  "stat_overlays": [
    {{
      "timestamp": float,
      "text": "statistic or key claim from transcript",
      "duration": 3
    }}
  ],
  "highlight_keywords": ["pcos", "vitamin", "insulin"],
  "pip_events": [
    {{
      "timestamp": float,
      "duration": float,
      "pip_format": "pip|full",
      "search_query": "short 2-3 word Pexels search phrase for stock video (e.g. pomegranate fruit, gut bacteria, healthy food)",
      "pip_description": "brief description of what the visual shows"
    }}
  ],
  "suggested_caption": "Instagram caption with emojis, under 150 words",
  "hashtags": "#nutrition #dietitian #healthyeating",
  "suggested_title": "YouTube video title",
  "overall_mood": "calm|energetic|serious|inspirational"
}}

Scene planning rules:
- Divide the transcript into meaningful narrative scenes (each scene = 8-12 seconds)
- In suggested_cuts, identify 2-5 segments to REMOVE. Include:
  • Silence or long pauses between sentences
  • Filler words ("um", "uh", "like") or their surrounding pauses
  • Retakes — repeated phrases, false starts, or self-corrections ("I mean...", "actually...", "sorry...")
  • Dead space at very start (before first real word) or end (silence after last word)
- Extract any statistics, numbers, or key claims for stat_overlays
- Identify 5 moments where a relevant stock video would make the content more engaging. Add them as pip_events (duration 4-8 seconds each, spaced at least 6 seconds apart).
  - Use "pip" format when you want the speaker visible in a small corner overlay while the stock video plays.
  - Use "full" format when the stock video should play full-screen without the speaker visible.
- For each pip_event provide a search_query — a short 2-4 word phrase for Pexels stock video search. Ensure queries are relevant to FitMantra's brand: gut health, nutrition, healthy food, supplements, natural ingredients, active lifestyle, wellness. Do NOT search for generic or unrelated content.
- overall_mood determines background music selection
- Add 25-45 highlight_keywords — these are attention-worthy words that will trigger zoom effects on the speaker. Include PLENTY of words so the caption highlights are dense and frequent. PRIORITIZE proper nouns and key facts: the speaker's name, country/city, profession/designation, medical credentials (e.g. "anesthesiologist", "surgeon"), and any concrete numbers, statistics, conditions, symptoms, treatments, and health/brand terms mentioned.
- Add 10-20 relevant capitalize_words — important proper nouns and attention-grabbing words to render in CAPS (e.g. the speaker's name, country, her designation, or key claims). Pick words that appear verbatim in the transcript. Include the words "Fit" and "Mantra".
- video total duration: {duration_seconds:.0f}s — plan scenes to cover the full duration

Transcript:
{full_text}

Word timestamps (first 120 words for reference):
{json.dumps(words[:120], indent=2)}"""

    from google.genai.errors import ClientError, ServerError

    t0 = time.time()
    result = None
    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.4,
                ),
            )
            text = response.text.strip()
            if text.startswith("```"):
                text = text.strip("`").strip()
                if text.startswith("json"):
                    text = text[4:].strip()
            result = json.loads(text)
            break
        except (ClientError, ServerError) as e:
            if e.code in (429, 500, 502, 503):
                wait = 3
                print(f"    ⏳ Gemini busy (attempt {attempt+1}/3), retrying in {wait}s...")
                if progress_callback:
                    progress_callback(3, "running", f"Gemini busy (attempt {attempt+1}/3), retry in {wait}s",
                                     "gemini_analyse", time.time() - t0, time.time() - t0)
                time.sleep(wait)
            else:
                print(f"    ⚠ Gemini failed ({e.code}), using fallback analysis")
                break

    if result is None:
        # Fallback: basic analysis from transcript
        print(f"    ⚠ Generating fallback analysis from transcript...")
        word_count = len(words)
        dur = words[-1]["end"] if words else 60
        result = {
            "scenes": [{"start": 0, "end": dur, "tone": "educational", "narration_summary": full_text[:100]}],
            "suggested_cuts": [{"start": dur - 2, "end": dur, "reason": "end silence", "confidence": 0.8}],
            "stat_overlays": [],
            "highlight_keywords": [],
            "pip_events": [],
            "suggested_caption": full_text[:150],
            "hashtags": "#health #wellness",
            "suggested_title": "Health Talk",
            "overall_mood": "calm",
        }
        # Extract numbers as stat overlay candidates
        import re
        nums = re.findall(r'\d+[\.,]?\d*%?', full_text)
        for i, n in enumerate(nums[:5]):
            idx = full_text.find(n)
            if idx >= 0:
                ts = dur * idx / max(len(full_text), 1)
                result["stat_overlays"].append({"timestamp": round(ts, 1), "text": n + " — " + full_text[max(0,idx-20):idx+len(n)+20].strip(), "duration": 3})
        # Create 3 pip events at regular intervals
        for i in range(3):
            ts = dur * (i + 1) / 4
            result["pip_events"].append({"timestamp": round(ts, 1), "duration": 5, "pip_format": "pip", "search_query": "health wellness", "pip_description": "Generic health visual"})
        # Use common words as highlight keywords (expanded for density)
        common_kw = ["health", "nutrition", "food", "body", "hormones", "insulin", "blood", "sugar", "heart", "risk",
                     "pain", "doctor", "surgery", "hospital", "patient", "treatment", "medicine", "symptoms",
                     "vitamin", "disease", "immune", "energy", "diet", "exercise", "weight", "sleep", "stress",
                     "mental", "hormone", "thyroid", "diabetes", "obesity", "gut", "inflammation", "infection",
                     "clinic", "research", "study", "result", "percent", "years", "women", "children", "india",
                     "saudi", "fit", "mantra"]
        result["highlight_keywords"] = [w for w in common_kw if w in full_text.lower()][:40]
        result["capitalize_words"] = [w for w in common_kw if w in full_text.lower()][:15]

    # Save analysis
    analysis_path = output_dir / "analysis.json"
    with open(analysis_path, "w") as f:
        json.dump(result, f, indent=2)

    scenes = result.get("scenes", [])
    cuts = result.get("suggested_cuts", [])
    stats = result.get("stat_overlays", [])
    pips = result.get("pip_events", [])
    print(f"    ✔ Analysis complete")
    print(f"    Found: {len(scenes)} scenes, "
          f"{len(cuts)} cuts, {len(stats)} stat overlays, "
          f"{len(pips)} pip events ({sum(p.get('duration',0) for p in pips):.0f}s total)")
    for p in pips:
        print(f"         {p['timestamp']:.0f}s ({p['duration']:.0f}s): {p.get('search_query', '?')}")
    return result
