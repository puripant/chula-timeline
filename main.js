const margins = { top: 40, bottom: 40, left: 40, right: 150 }
const width = 800
const height = 500
const key = (key) => key.split(" ")[0]

d3.csv("data.csv").then((data) => {
d3.csv("colors.csv").then((colors) => {
  data = data.filter(d => d.type != "context")

  let color_scale = d3.scaleOrdinal(colors.map(d => d.faculty), colors.map(d => d.rgb))
    .unknown("#000000");
  let x_scale = d3.scaleLinear(d3.extent(data, d => +d.year), [margins.left, margins.left + width])
    .unknown(margins.left)

  let faculties = colors.map(d => d.faculty) //[...new Set(data.map(d => [key(d.from), key(d.to)]).flat())]
  let y_scale = d3.scalePoint(faculties, [margins.top, margins.top + height])

  data.sort((a, b) => +a.year - +b.year)
  data = Array.from(d3.group(data, d => d.year), ([key, value]) => value)
  let levels = data.map(year => {
    return Array.from(d3.group(year, d => d.to), ([key, value]) => ({
      id: value[0].to, 
      parents: value.map(d => d.from),
      year: value[0].year
    }))
  })

  // Adapted from https://observablehq.com/@nitaku/tangled-tree-visualization-ii
  // precompute level depth
  levels.forEach((l,i) => l.forEach(n => n.level = i))

  let nodes = levels.reduce( ((a,x) => a.concat(x)), [] )
  let nodes_index = {}
  nodes.forEach(d => nodes_index[d.id] = d)

  // objectification
  nodes.forEach(d => {
    d.parents = (d.parents === undefined || d.parents[0] === "" ? [] : d.parents).map(p => nodes_index[p])
  })

  // precompute bundles
  levels.forEach((l, i) => {
    let index = {}
    l.forEach(n => {
      if(n.parents.length == 0) {
        return
      }
      
      let id = n.parents.map(d => d.id).sort().join('--')
      if (id in index) {
        index[id].parents = index[id].parents.concat(n.parents)
      } else {
        index[id] = {id: id, parents: n.parents.slice(), level: i}
      }
      n.bundle = index[id]
    })
    l.bundles = Object.keys(index).map(k => index[k])
    l.bundles.forEach((b, i) => b.i = i)
  })

  let links = []
  nodes.forEach(d => {
    d.parents.forEach(p => links.push({source: d, bundle: d.bundle, target: p}))
  })

  let bundles = levels.reduce((a,x) => a.concat(x.bundles), [])

  // reverse pointer from parent to bundles
  bundles.forEach(b => b.parents.forEach(p => {
    if(p.bundles_index === undefined) {
      p.bundles_index = {}
    }
    if(!(b.id in p.bundles_index)) {
      p.bundles_index[b.id] = [] 
    }
    p.bundles_index[b.id].push(b)
  }))

  nodes.forEach(n => {
    if(n.bundles_index !== undefined) {
      n.bundles = Object.keys(n.bundles_index).map(k => n.bundles_index[k])
    }
    else {
      n.bundles_index = {}
      n.bundles = []
    }
    n.bundles.forEach((b, i) => b.i = i)
  })

  links.forEach(l => {
    if(l.bundle.links === undefined) {
      l.bundle.links = []
    }
    l.bundle.links.push(l)
  })

  // layout
  const node_height = 22
  const metro_d = 4

  nodes.forEach(n => n.height = 0) //(Math.max(1, n.bundles.length)-1)*metro_d)

  levels.forEach(l => {
    l.forEach((n, i) => {
      n.x = x_scale(n.year)
      n.y = y_scale(key(n.id))
    })
  })

  let i = 0
  levels.forEach(l => {
    l.bundles.forEach(b => {
      b.x = b.parents[0].x
      b.y = i*node_height
    })
    i += l.length
  })
    
  links.forEach(l => {
    l.xt = l.target.x
    l.yt = l.target.y // + l.target.bundles_index[l.bundle.id].i*metro_d - l.target.bundles.length*metro_d/2 + metro_d/2
    l.xs = l.source.x
    l.ys = l.source.y
  })

  let svg = d3.select('svg')
    .attr("width", width + margins.left + margins.right)
    .attr("height", height + margins.top + margins.bottom)

  let append_path = (d, color, width) => {
    svg.append("path")
      .classed("link", true)
      .attr("d", d)
      .style("stroke", color)
      .style("stroke-width", width)
  }
  let append_link = (d, color) => {
    append_path(d, color === "#FFFFFF" ? "gainsboro" : "white", 5)
    append_path(d, color, 2)
  }

  let append_line = (xy1, xy2, color, width) => {
    svg.append("line")
      .classed("node", true)
      .attr("x1", xy1[0])
      .attr("y1", xy1[1])
      .attr("x2", xy2[0])
      .attr("y2", xy2[1])
      .style("stroke", color)
      .style("stroke-width", width)
  }
  let append_text = (xy, text, color, width, text_color) => {
    svg.append("text")
      .attr("x", xy[0])
      .attr("y", xy[1])
      .style("stroke", color)
      .style("stroke-width", width)
      .style("fill", text_color ? text_color : "black")
      .text(text)
  }
  let append_node = (xy1, xy2, text, rightmost, color) => {
    append_line(xy1, xy2, color === "#FFFFFF" ? "gainsboro" : "white", 12)
    append_line(xy1, xy2, color, 8)
    append_text([xy1[0]+6, xy1[1] + (rightmost ? 2 : -4)], text, "white", 3)
    append_text([xy1[0]+6, xy1[1] + (rightmost ? 2 : -4)], text, "black", 0)
  }

  const x_2475 = x_scale(2475)
  append_line([x_2475, 0], [x_2475, height + margins.top + margins.bottom], "gainsboro", 10)
  append_text([x_2475 + 10, 20], "การปฏิวัติสยาม", "gainsboro", 0, "gray")

  bundles.forEach(b => {
    let link = d3.linkHorizontal();
    let d = b.links.map(l => link({
      source: [l.xs, l.ys],
      target: [l.xt, l.yt]
    })).join("");

    append_link(d, color_scale(key(b.id)))
  })

  nodes.map(n => {
    let xy1 = [n.x, n.y-n.height/2]
    let xy2 = [n.x, n.y+n.height/2]
    append_node(xy1, xy2, key(n.id), n.id.slice(-10) === "(ปัจจุบัน)", color_scale(key(n.id)))
  })

})
})