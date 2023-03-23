#!/bin/bash
git remote update
UPSTREAM=${1:-'@{u}'}
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse "$UPSTREAM")
BASE=$(git merge-base @ "$UPSTREAM")
if [ $LOCAL = $REMOTE ]; then
    	echo "Stationbot is up to date."
elif [ $LOCAL = $BASE ]; then
    	echo "Updating Stationbot..."
	git pull
	pnpm build
	echo "StationBot Has been Updated"
fi
