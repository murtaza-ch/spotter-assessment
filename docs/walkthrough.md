# Walkthrough outline

Target length: about eight minutes. Use the hosted application once deployed. Until then,
state clearly that the demonstration is local. Hide environment files and provider dashboards
while recording.

## 0:00-1:15: Plan a real trip

Explain the goal: compare truck routes by forecast exposure at estimated arrival times.
Use Chicago to Detroit, select a future departure, enter 35,000 lb, and choose 25-mile
checkpoints. Submit and explain that routing and weather come from live providers.

## 1:15-2:45: Compare routes and checkpoints

Show the three alternatives, recommendation marker, duration, mileage, Severe/High miles,
and average risk. Select a different route. Point out that all checkpoints remain on the
map, with the selected route emphasized. Open a checkpoint and read its dated ETA and
wind, rain, and snow measurements. Demonstrate the accessible checkpoint list as well.

## 2:45-3:45: Explore the corridor forecast

Move the slider from departure through +48 hours, then play and pause it. Toggle the
weather layer. Explain that the corridor shows a common forecast time, while route colors
and recommendations use each checkpoint's ETA. The slider uses downloaded frames rather
than making a request per movement.

## 3:45-5:15: Explain risk and recommendation

Show `backend/planning/domain/risk.py` and the documented interval boundaries. Explain
the strict load overrides and why unknown or No Travel segments cannot be recommended.
Show the ranking order and distance-weighted average. Use the tests to demonstrate unsafe
and missing-weather cases if the live forecast happens to be calm. Identify those cases
as test fixtures rather than live conditions.

## 5:15-6:45: Show code organization

Explain the monorepo's independent frontend and backend. Trace the request from the form
to DRF validation, service orchestration, provider adapters, and pure domain analysis.
Show that transport formatting and map geometry are separate. Mention SQLite's temporary
30-minute snapshots, server-only TomTom key, bounded requests, and provider caches.

## 6:45-8:00: Verify and discuss limits

Run `npm run check` and show the desktop/mobile browser results. Briefly demonstrate
forecast retry and the tested map fallback. Describe provider limits, fewer-than-three
route availability, incomplete forecasts, cargo-versus-gross-weight assumptions, and the
smoothed corridor model. Finish with the repository, hosted application, and test commands
that a reviewer can use.
