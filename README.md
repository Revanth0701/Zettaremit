# ZettaRemit Simulation

Current FastAPI + private Spring Boot calculator backend and Expo web frontend.
Simulation only: no real money movement or identity/compliance verification.

See docs/RELEASE.md for deployment settings and outstanding build-tool risk review.
No environment secrets, databases, financial reports or source Git history are included.

Backend: build Dockerfile from repository root. Only FastAPI is public; Java binds loopback.
Frontend: in frontend/, npm ci, npm test, npm run build:web; publish only dist.
Python offline tests: python -B -m unittest discover -s backend -p 'test_*_offline.py'.

The included schema SQL is a reviewed migration artifact, NOT a startup action.
The existing owner's Aiven database has already been migrated. Never rerun it blindly.
