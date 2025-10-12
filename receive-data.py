#!/usr/bin/python3

import warnings
warnings.filterwarnings("ignore", category=DeprecationWarning)

import cgi
import json
import base64
import gzip
import time
import os
import re
import traceback

allowed_sites = {
    'fobney': 1
}

allowed_types = {
    'himalayan-balsam': 1
}

response = {
    'error': 'No parameters!'
}

print("Content-Type: application/json")
print("Access-Control-Allow-Origin: *\n")

def error(message):
    response["error"] = message
    exit()

try:
    query = cgi.FieldStorage()
    if "site" not in query or query["site"].value not in allowed_sites:
        error("Invalid site!")
    site = query["site"].value

    if "type" not in query or query["type"].value not in allowed_types:
        error("Invalid type!")
    type = query["type"].value

    if "testmode" not in query:
        error("Invalid type!")
    testmode = query["testmode"].value
    if testmode == "false":
        testmode = 0

    if "comment" not in query or not re.match(r'[a-z0-9A-Z-]+', query["comment"].value):
        error("Invalid comment!")
    comment = query["comment"].value

    if "data" not in query:
        error("No data!")
    
    gz = base64.b64decode(query["data"].value)
    js = gzip.decompress(gz).decode('utf-8')
    geojson = json.loads(js)

    secs = time.strftime("%s", time.localtime())

    path = f'/home/huggie/public_html/{site}/data'
    if (testmode):
        path = path + '-test'
    path = path + '/'
    filename = f'{type}-{secs}-{comment}.json'

    with open(path+filename, "w") as f:
        f.write(js)


    ind = {}
    with os.scandir(path) as d:
        for file in d:
            name = file.name
            if name == "index.json" or name == ".htaccess":
                continue
            maptype = re.sub(r'^([a-z-]+)(-[0-9]+-[a-zA-Z0-9-]+)?\.json', r'\1', name)
            if not maptype in ind:
                ind[maptype] = []
            ind[maptype].append(name)

    for key in ind:
        ind[key].sort()

    with open(path+'index.json', "w") as f:
        f.write(json.dumps(ind))

    del response["error"]
    response["filename"] = filename

except Exception as err:
    response["error"] = str(traceback.format_exc())

finally:
    print(json.dumps(response))
