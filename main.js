const color_key = (key) => key.split(" ")[0]

d3.csv("data.csv").then((data) => {
d3.csv("colors.csv").then((colors) => {
  let faculties = colors.map(d => d.faculty)
  colors = colors.map(d => d.rgb)

  let color_scale = d3.scaleOrdinal(faculties, colors).unknown("#000000");

  data = data.filter(d => d.type != "context")
  data.sort((a, b) => +a.year - +b.year)
  data = Array.from(d3.group(data, d => d.year), ([key, value]) => value)
  let levels = data.map(year => {
    return Array.from(d3.group(year, d => d.to), ([key, value]) => ({id: value[0].to, parents: value.map(d => d.from)}))
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

  console.log(levels)

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

  let bundles = levels.reduce( ((a,x) => a.concat(x.bundles)), [] )

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
  const padding = 8
  const node_height = 22
  const node_width = 70
  const bundle_width = 14
  const level_y_padding = 16
  const metro_d = 4
  const c = 16
  const min_family_height = 16

  nodes.forEach(n => n.height = (Math.max(1, n.bundles.length)-1)*metro_d)

  let x_offset = padding
  let y_offset = padding
  levels.forEach(l => {
    x_offset += l.bundles.length*bundle_width
    y_offset += level_y_padding
    l.forEach((n, i) => {
      n.x = n.level*node_width + x_offset
      n.y = node_height + y_offset + n.height/2
      
      y_offset += node_height + n.height
    })
  })

  let i = 0
  levels.forEach(l => {
    l.bundles.forEach(b => {
      b.x = b.parents[0].x + node_width + (l.bundles.length-1-b.i)*bundle_width
      b.y = i*node_height
    })
    i += l.length
  })
    
  links.forEach(l => {
    l.xt = l.target.x
    l.yt = l.target.y + l.target.bundles_index[l.bundle.id].i*metro_d - l.target.bundles.length*metro_d/2 + metro_d/2
    l.xb = l.bundle.x
    l.xs = l.source.x
    l.ys = l.source.y
  })

  // // compress vertical space
  // let y_negative_offset = 0
  // levels.forEach(l => {
  //   y_negative_offset += -min_family_height + d3.min(l.bundles, b => d3.min(b.links, link => (link.ys-c)-(link.yt+c))) || 0
  //   l.forEach(n => n.y -= y_negative_offset)
  // })

  // very ugly, I know
  links.forEach(l => {
    l.yt = l.target.y + l.target.bundles_index[l.bundle.id].i*metro_d - l.target.bundles.length*metro_d/2 + metro_d/2
    l.ys = l.source.y
    l.c1 = l.source.level-l.target.level > 1 ? node_width+c : c
    l.c2 = c
  })

  const height = d3.max(nodes, n => n.y) + node_height/2 + 2*padding
  let svg = d3.select('svg')
    .attr("width", 2500)
    .attr("height", height)

  let append_path = (d, color, width) => {
    svg.append("path")
      .classed("link", true)
      .attr("d", d)
      .style("stroke", color)
      .style("stroke-width", width)
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
  let append_node = (xy1, xy2, text, color) => {
    append_line(xy1, xy2, color === "#FFFFFF" ? "gainsboro" : "white", 12)
    append_line(xy1, xy2, color, 8)
    append_text([xy1[0]+6, xy1[1]-4], text, "white", 3)
    append_text([xy1[0]+6, xy1[1]-4], text, "black", 0)
  }

  append_line([node_width*5, 0], [node_width*5, height], "gainsboro", 10)
  append_text([node_width*5 + 10, 20], "การปฏิวัติสยาม", "gainsboro", 0, "gray")

  bundles.forEach(b => {
    let d = b.links.map(l => `
      M${ l.xt } ${ l.yt }
      L${ l.xb-l.c1 } ${ l.yt }
      A${ l.c1 } ${ l.c1 } 90 0 1 ${ l.xb } ${ l.yt+l.c1 }
      L${ l.xb } ${ l.ys-l.c2 }
      A${ l.c2 } ${ l.c2 } 90 0 0 ${ l.xb+l.c2 } ${ l.ys }
      L${ l.xs } ${ l.ys }`
    ).join("");

    append_path(d, "white", 5)
    append_path(d, "black", 2)
  })

  nodes.map(n => {
    let xy1 = [n.x, n.y-n.height/2]
    let xy2 = [n.x, n.y+n.height/2]
    append_node(xy1, xy2, n.id, color_scale(color_key(n.id)))
  })

})
})