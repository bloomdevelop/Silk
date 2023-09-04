#!/bin/bash
cd ~/unimate
git remote update
UPSTREAM=${1:-'@{u}'}
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse "$UPSTREAM")
BASE=$(git merge-base @ "$UPSTREAM")
if [ $LOCAL = $REMOTE ]; then
    	echo "Unimate is up to date."
elif [ $LOCAL = $BASE ]; then
    	echo "Unimate Stationbot..."
	git pull
	pnpm build
	echo "Unimate Has been Updated"
fi
